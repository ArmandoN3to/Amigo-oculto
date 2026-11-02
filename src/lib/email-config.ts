import type { RuntimeStatus } from './types';

type EmailEnvironment = Record<string, string | undefined>;
export function getEmailConfiguration(env: EmailEnvironment = process.env): Pick<RuntimeStatus, 'emailConfigured' | 'emailConfigurationIssues' | 'emailWarnings'> {
  const issues: string[] = [];
  const warnings: string[] = [];
  const user = env.GMAIL_USER?.trim();
  if (!user || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(user)) issues.push('Preencha GMAIL_USER com o endereço completo da sua conta Gmail.');
  if (!/^[a-zA-Z0-9]{16}$/.test((env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''))) issues.push('Preencha GMAIL_APP_PASSWORD com a senha de app de 16 caracteres do Google.');
  if (env.EMAIL_FROM_NAME && /[\r\n]/.test(env.EMAIL_FROM_NAME)) issues.push('EMAIL_FROM_NAME não pode conter quebras de linha.');
  try {
    const url = new URL(env.APP_URL || '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (local) warnings.push('APP_URL usa localhost: os links dos convites só abrem neste computador. Para acesso dos familiares, configure uma URL acessível por eles.');
    if ((env.VERCEL || env.HOSTED_DEPLOYMENT === 'true' || env.NODE_ENV === 'production' && !local) && url.protocol !== 'https:') issues.push('APP_URL precisa usar HTTPS quando a aplicação estiver hospedada.');
  } catch { issues.push('Preencha APP_URL com uma URL válida começando por http:// ou https://.'); }
  return {emailConfigured: issues.length === 0, emailConfigurationIssues: issues, emailWarnings: warnings};
}
