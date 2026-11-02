import "server-only";
import { getDb } from "./db";
import { keyedHash } from "./crypto";
import { AppError } from "./errors";

export async function consumeRateLimit(key: string, limit: number, minutes = 15): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - minutes * 60_000).toISOString();
  const result = await db.query<{ attempts: number }>(`
    INSERT INTO rate_limits(bucket_key,window_started,attempts) VALUES($1,$2,1)
    ON CONFLICT(bucket_key) DO UPDATE SET
      attempts=CASE WHEN rate_limits.window_started < $3 THEN 1 ELSE rate_limits.attempts+1 END,
      window_started=CASE WHEN rate_limits.window_started < $3 THEN $2 ELSE rate_limits.window_started END
    RETURNING attempts`, [keyedHash(`rate:${key}`), now.toISOString(), cutoff]);
  if (result.rows[0].attempts > limit) throw new AppError(`Muitas tentativas. Aguarde ${minutes} minutos e tente novamente.`, "RATE_LIMITED");
}
