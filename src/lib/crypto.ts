import { createHash, createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
export function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export function randomSecret(): string { return randomBytes(32).toString("base64url"); }
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Execute npm run setup para configurar um AUTH_SECRET seguro.");
  return secret;
}
export function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function keyedHash(value: string): string { return createHmac("sha256", authSecret()).update(value).digest("hex"); }
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  // Colon separators survive Next.js dotenv variable expansion.
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, hash] = encoded.split(/[:$]/);
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(hash || "")) return false;
  const key = await scrypt(password, salt, 64) as Buffer;
  return secureEqual(key.toString("hex"), hash);
}
