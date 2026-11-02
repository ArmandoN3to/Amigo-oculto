import { existsSync } from "node:fs";
import { getDb, closeDb, storageMode } from "../src/lib/db";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  try {
    await getDb();
    console.log(`Estrutura do banco verificada (${storageMode() === "local" ? "PostgreSQL local PGlite" : "PostgreSQL externo"}).`);
  } finally { await closeDb(); }
}
main().catch(() => { console.error("Não foi possível migrar. Confira DATABASE_URL ou o acesso à pasta .data local."); process.exitCode = 1; });
