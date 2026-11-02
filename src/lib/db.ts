import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { INITIAL_SCHEMA } from "./schema";

export interface QueryResult<T> { rows: T[]; rowCount: number }
export interface SqlClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
}
export interface Database extends SqlClient {
  transaction<T>(run: (client: SqlClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const runtime = globalThis as typeof globalThis & { familyDb?: Promise<Database> };

export function storageMode(): "local" | "postgres" {
  return process.env.DATABASE_URL ? "postgres" : "local";
}

async function connect(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10_000 });
    const migrator = await pool.connect();
    let migrationError: unknown;
    try {
      await migrator.query("BEGIN");
      await migrator.query("SELECT pg_advisory_xact_lock(726510001)");
      await migrator.query(INITIAL_SCHEMA);
      await migrator.query("COMMIT");
    } catch (error) {
      migrationError = error;
      await migrator.query("ROLLBACK").catch(() => undefined);
    } finally { migrator.release(); }
    if (migrationError) { await pool.end(); throw migrationError; }
    return {
      async query<T extends Record<string, unknown>>(sql: string, values?: unknown[]) {
        const result = await pool.query<T>(sql, values);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      },
      async transaction<T>(run: (client: SqlClient) => Promise<T>) {
        const connection = await pool.connect();
        try {
          await connection.query("BEGIN");
          const value = await run({ async query<R extends Record<string, unknown>>(sql: string, values?: unknown[]) {
            const result = await connection.query<R>(sql, values);
            return { rows: result.rows, rowCount: result.rowCount ?? 0 };
          } });
          await connection.query("COMMIT");
          return value;
        } catch (error) { await connection.query("ROLLBACK"); throw error; }
        finally { connection.release(); }
      },
      close: () => pool.end(),
    };
  }
  const remoteProduction = process.env.NODE_ENV === "production" && process.env.APP_URL && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(process.env.APP_URL);
  if (process.env.VERCEL || process.env.HOSTED_DEPLOYMENT === "true" || remoteProduction) {
    throw new Error("Configure DATABASE_URL com PostgreSQL antes de hospedar a aplicação. O banco local serve apenas para execução neste computador.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.LOCAL_DATABASE_DIR === ":memory:" ? undefined : path.resolve(/* turbopackIgnore: true */ process.env.LOCAL_DATABASE_DIR || ".data/postgres");
  if (dataDir) await mkdir(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  await db.exec(INITIAL_SCHEMA);
  return {
    async query<T extends Record<string, unknown>>(sql: string, values?: unknown[]) {
      const result = await db.query<T>(sql, values);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    },
    transaction: (run) => db.transaction(async (tx) => run({
      async query<T extends Record<string, unknown>>(sql: string, values?: unknown[]) {
        const result = await tx.query<T>(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
      },
    })),
    close: () => db.close(),
  };
}

export function getDb(): Promise<Database> {
  runtime.familyDb ??= connect().catch((error) => { runtime.familyDb = undefined; throw error; });
  return runtime.familyDb;
}

export async function closeDb(): Promise<void> {
  if (runtime.familyDb) {
    const current = runtime.familyDb;
    runtime.familyDb = undefined;
    await (await current).close();
  }
}
