import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { createRequire as createTsRequire } from 'node:module';
const requireTs = createTsRequire(import.meta.url);
const { getEmailConfiguration } = requireTs('../src/lib/email-config.ts');
const { createGmailTransport, gmailSender, gmailErrorMessage } = requireTs('../src/lib/gmail.ts');

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const envPath = path.resolve('.env.local');
nextRequire('@next/env').loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const emailPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
async function hiddenPassword() {
  if (!stdin.isTTY) throw new Error('Execute o assistente em um terminal interativo. A senha de app não deve ser informada como argumento.');
  stdout.write('Cole a senha de app do Google (16 caracteres; entrada oculta): ');
  stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    function done() { stdin.off('data', onData); stdin.setRawMode(false); stdin.pause(); stdout.write('\n'); }
    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\u0003') { done(); reject(new Error('Configuração cancelada; nenhum dado alterado.')); return; }
        if (char === '\r' || char === '\n') { done(); resolve(value.trim()); return; }
        if (char === '\b' || char === '\u007f') value = value.slice(0, -1);
        else if (char >= ' ' && value.length < 1024) value += char;
      }
    }
    stdin.on('data', onData);
  });
}
async function main() {
  if (process.argv.includes('--help')) { console.log('npm run setup:email  Configura Gmail e senha de app em .env.local (entrada oculta).\nnpm run email:check  Verifica a configuração sem enviar mensagens nem exibir segredos.\nnpm run email:test   Solicita o destinatário e envia UMA mensagem de teste sem dados do sorteio.'); return; }
  if (process.argv.includes('--setup')) {
    const prompt = createInterface({ input: stdin, output: stdout });
    let user; let name; let appUrl;
    try {
      user = (await prompt.question('Seu endereço Gmail completo: ')).trim().toLowerCase();
      name = (await prompt.question('Nome do remetente (Enter: Amigo Oculto): ')).trim() || 'Amigo Oculto';
      appUrl = (await prompt.question('URL da aplicação (Enter: manter a atual ou http://localhost:3000): ')).trim() || process.env.APP_URL || 'http://localhost:3000';
    } finally { prompt.close(); }
    const password = (await hiddenPassword()).replace(/\s/g, '');
    const changes = { GMAIL_USER: user, GMAIL_APP_PASSWORD: password, EMAIL_FROM_NAME: name, APP_URL: appUrl };
    const validation = getEmailConfiguration(changes);
    if (!validation.emailConfigured) throw new Error(validation.emailConfigurationIssues.join('\n'));
    changes.APP_URL = new URL(appUrl).origin;
    const existing = existsSync(envPath) ? await readFile(envPath, 'utf8') : '';
    const seen = new Set();
    const encode = value => JSON.stringify(value).replaceAll('$', '\\$');
    const lines = existing.split(/\r?\n/).map(line => {
      const name = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=/)?.[1];
      if (['RESEND_API_KEY', 'EMAIL_FROM'].includes(name)) return '';
      if (!(name in changes)) return line;
      if (seen.has(name)) return ''; seen.add(name);
      return `${name}=${encode(changes[name])}`;
    });
    for (const [name, value] of Object.entries(changes)) if (!seen.has(name)) lines.push(`${name}=${encode(value)}`);
    await writeFile(envPath, lines.join('\n').trim() + '\n', { mode: 0o600 });
    console.log('Configuração salva em ' + envPath + '. Credenciais do organizador preservadas.');
    console.log('Agora execute npm run email:test. Depois reinicie npm run dev e use Enviar pendentes e tentar falhas, sem refazer o sorteio.');
    return;
  }
  const errors = getEmailConfiguration().emailConfigurationIssues;
  if (errors.length) throw new Error('Configuração incompleta em ' + envPath + ':\n' + errors.join('\n'));
  if (!process.argv.includes('--test')) {
    console.log('Gmail, senha de app e URL preenchidos. A autenticação ainda precisa ser confirmada com npm run email:test.');
    return;
  }
  if (!stdin.isTTY) throw new Error('Execute npm run email:test em um terminal interativo para informar o destinatário.');
  const prompt = createInterface({ input: stdin, output: stdout });
  let to;
  try { to = (await prompt.question('E-mail que receberá UMA mensagem de teste: ')).trim(); }
  finally { prompt.close(); }
  if (!emailPattern.test(to)) throw new Error('Destinatário inválido; nenhuma mensagem foi enviada.');
  const transport = createGmailTransport();
  try {
    const result = await transport.sendMail({ from: gmailSender(), to: [to], subject: 'Teste de envio — Amigo Oculto da Família', text: 'O envio pelo Gmail está conectado. Esta mensagem de teste não contém resultados do sorteio.' });
    if (!result.accepted?.length) throw new Error('Destinatário não aceito');
    console.log('Mensagem aceita pelo Gmail. Confira sua caixa de entrada e spam.');
    console.log('O teste não alterou o sorteio nem marcou os resultados como enviados.');
  } catch (error) { throw new Error(gmailErrorMessage(error)); }
  finally { transport.close(); }

}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Não foi possível concluir a configuração do Gmail.');
  process.exitCode = 1;
});
