import "server-only";
import { cookies, headers } from "next/headers";
import { getDb } from "./db";
import { authSecret, randomSecret, sha256, secureEqual, verifyPassword } from "./crypto";
import { consumeRateLimit } from "./rate-limit";
import { AppError } from "./errors";

const COOKIE_NAME = "ao_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && /^scrypt([:$])[a-f0-9]{32}\1[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH || "") && process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
}
export async function getAdminSession(): Promise<{ email: string } | null> {
  if (!adminConfigured()) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const db = await getDb();
  const result = await db.query("SELECT token_hash FROM admin_sessions WHERE token_hash=$1 AND expires_at > $2", [sha256(token), new Date().toISOString()]);
  return result.rows.length ? { email: process.env.ADMIN_EMAIL! } : null;
}
export async function requireAdmin(): Promise<{ email: string }> {
  const session = await getAdminSession();
  if (!session) throw new AppError("Entre na área do organizador para continuar.", "UNAUTHORIZED");
  return session;
}
export async function signIn(email: string, password: string): Promise<void> {
  if (!adminConfigured()) throw new AppError("O organizador ainda não foi configurado. Execute npm run setup neste computador.");
  authSecret();
  const requestHeaders = await headers();
  // Global and per-origin limits remain effective across serverless instances.
  // Only trust the forwarded client address on Vercel; elsewhere the single
  // local bucket cannot be bypassed by supplying arbitrary proxy headers.
  const address = process.env.VERCEL ? requestHeaders.get("x-vercel-forwarded-for") || requestHeaders.get("x-forwarded-for") || "unknown" : "local";
  await consumeRateLimit("login:global", 40);
  await consumeRateLimit(`login:address:${address}`, 8);
  const validEmail = secureEqual(email.trim().toLowerCase(), process.env.ADMIN_EMAIL!.trim().toLowerCase());
  const validPassword = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH!);
  if (!validEmail || !validPassword) throw new AppError("E-mail ou senha incorretos.", "INVALID_CREDENTIALS");
  const db = await getDb();
  const token = randomSecret();
  await db.query("DELETE FROM admin_sessions WHERE expires_at <= $1", [new Date().toISOString()]);
  await db.query("INSERT INTO admin_sessions(token_hash,expires_at) VALUES($1,$2)", [sha256(token), new Date(Date.now() + SESSION_SECONDS * 1000).toISOString()]);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true, sameSite: "strict", secure: Boolean(process.env.VERCEL || process.env.APP_URL?.startsWith("https://")),
    path: "/", maxAge: SESSION_SECONDS,
  });
}
export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await (await getDb()).query("DELETE FROM admin_sessions WHERE token_hash=$1", [sha256(token)]);
  cookieStore.delete(COOKIE_NAME);
}
