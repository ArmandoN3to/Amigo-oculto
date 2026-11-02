import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { z } from "zod";
import { hashPassword, randomSecret } from "../src/lib/crypto";

function argument(name: string): string | undefined {
  const match = process.argv.find(value => value.startsWith(`--${name}=`));
  if (match) return match.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
async function hiddenQuestion(label: string): Promise<string> {
  if (!stdin.isTTY) throw new Error("Em execução não interativa, informe --email e --password-stdin.");
  stdout.write(label);
  stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    function done() { stdin.removeListener("data", onData); stdin.setRawMode(false); stdin.pause(); stdout.write("\n"); }
    function onData(chunk: string) {
      for (const character of chunk) {
        if (character === "\u0003") { done(); reject(new Error("Configuração cancelada.")); return; }
        if (character === "\r" || character === "\n") { done(); resolve(value); return; }
        if (character === "\u007f" || character === "\b") { value = value.slice(0, -1); continue; }
        if (character >= " " && value.length < 256) value += character;
      }
    }
    stdin.on("data", onData);
  });
}
async function main() {
  if (process.argv.includes("--help")) {
    console.log("npm run setup\nConfiguração interativa do organizador, com senha oculta.\n\nOpções: --email=EMAIL --password-stdin [--app-url=URL] [--reset-admin]\nA senha é lida da entrada padrão, nunca de argumentos. --reset-admin troca a credencial e revoga sessões; execute com o servidor local parado.");
    return;
  }
  const envFile = path.resolve(".env.local");
  const existing = existsSync(envFile) ? await readFile(envFile, "utf8") : "";
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const reset = process.argv.includes("--reset-admin");
  if (process.env.ADMIN_EMAIL && /^scrypt([:$])[a-f0-9]{32}\1[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH || "") && (process.env.AUTH_SECRET?.length || 0) >= 32 && !reset) {
    console.log("O organizador já está configurado. Use --reset-admin para trocar suas credenciais.");
    return;
  }
  let email = argument("email");
  if (!email) {
    if (!stdin.isTTY) throw new Error("Informe --email=seu@email.com e forneça a senha pelo stdin com --password-stdin.");
    const prompt = createInterface({ input: stdin, output: stdout });
    email = await prompt.question("E-mail do organizador: ");
    prompt.close();
  }
  email = z.string().trim().toLowerCase().email("Informe um e-mail válido.").parse(email);
  let password: string;
  if (process.argv.includes("--password-stdin")) {
    if (stdin.isTTY) throw new Error("--password-stdin exige entrada redirecionada. Para digitar a senha com segurança, execute sem essa opção.");
    let input = "";
    for await (const chunk of stdin) {
      input += chunk.toString();
      if (input.length > 1024) throw new Error("Entrada da senha excede o tamanho permitido.");
    }
    password = input.replace(/\r?\n$/, "");
  } else {
    password = await hiddenQuestion("Crie uma senha (mínimo 12 caracteres; entrada oculta): ");
    const confirmation = await hiddenQuestion("Repita a senha: ");
    if (password !== confirmation) throw new Error("As senhas não coincidem.");
  }
  if (password.length < 12 || password.length > 256) throw new Error("A senha precisa ter entre 12 e 256 caracteres.");
  const appUrl = argument("app-url") || process.env.APP_URL || "http://localhost:3000";
  const parsedUrl = new URL(appUrl);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("APP_URL deve começar com http:// ou https://.");
  const changes: Record<string, string> = {
    AUTH_SECRET: process.env.AUTH_SECRET || randomSecret(),
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD_HASH: await hashPassword(password),
    APP_URL: parsedUrl.origin,
  };
  const lines = existing.split(/\r?\n/);
  const updated = new Set<string>();
  const output = lines.map(line => {
    const key = line.match(/^\s*([A-Z_]+)\s*=/)?.[1];
    if (key && key in changes) { updated.add(key); return `${key}=${JSON.stringify(changes[key])}`; }
    return line;
  });
  for (const [key, value] of Object.entries(changes)) if (!updated.has(key)) output.push(`${key}=${JSON.stringify(value)}`);
  await writeFile(envFile, `${output.filter((line, index) => line || index > 0).join("\n").trim()}\n`, { encoding: "utf8", mode: 0o600 });
  // A password change revokes current sessions without invalidating family links.
  if (reset) {
    const { getDb, closeDb } = await import("../src/lib/db");
    try { await (await getDb()).query("DELETE FROM admin_sessions"); } finally { await closeDb(); }
  }
  console.log("Organizador configurado em .env.local. Nenhuma senha foi gravada em texto puro.");
  console.log("Execute npm run dev e acesse /admin/login. E-mails reais exigem GMAIL_USER, GMAIL_APP_PASSWORD e APP_URL acessível à família.");
}
main().catch(error => { console.error(error instanceof z.ZodError ? "Informe um e-mail válido." : error instanceof Error ? error.message : "Não foi possível configurar o organizador."); process.exitCode = 1; });
