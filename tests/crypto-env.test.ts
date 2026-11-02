import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { hashPassword, verifyPassword } from '../src/lib/crypto';

it('preserva o hash gerado ao carregar .env.local com o carregador real do Next.js', async () => {
  const hash = await hashPassword('SenhaFicticiaParaRegressao2026!');
  const folder = mkdtempSync(path.join(tmpdir(), 'amigo-env-'));
  try {
    writeFileSync(path.join(folder, '.env.local'), `ADMIN_PASSWORD_HASH=${JSON.stringify(hash)}\n`);
    const require = createRequire(import.meta.url);
    const script = `delete process.env.ADMIN_PASSWORD_HASH; delete process.env.__NEXT_PROCESSED_ENV; process.env.NODE_ENV="development"; require(${JSON.stringify(require.resolve('@next/env'))}).loadEnvConfig(${JSON.stringify(folder)},true,{info(){},error(){}});process.stdout.write(process.env.ADMIN_PASSWORD_HASH||'');`;
    const loaded = execFileSync(process.execPath, ['-e', script], {encoding:'utf8'});
    expect(loaded).toBe(hash);
    expect(await verifyPassword('SenhaFicticiaParaRegressao2026!', loaded)).toBe(true);
    expect(await verifyPassword('OutraSenha', loaded)).toBe(false);
  } finally { rmSync(folder, {recursive:true,force:true}); }
});

it('continua validando hashes antigos com separadores de dólar', async () => {
  const hash = await hashPassword('SenhaFicticiaParaLegado2026!');
  expect(await verifyPassword('SenhaFicticiaParaLegado2026!', hash.replaceAll(':', '$'))).toBe(true);
});
