import {it,expect} from 'vitest';
import {getEmailConfiguration} from '../src/lib/email-config';
const gmail = {GMAIL_USER:'familia@gmail.com', GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop'};
it('identifica credenciais ausentes sem expor segredos e avisa sobre localhost',()=>{
 const c=getEmailConfiguration({APP_URL:'http://localhost:3000'});
 expect(c.emailConfigured).toBe(false);
 expect(c.emailConfigurationIssues.join(' ')).toContain('GMAIL_USER');
 expect(c.emailConfigurationIssues.join(' ')).toContain('GMAIL_APP_PASSWORD');
 expect(c.emailWarnings.join(' ')).toContain('localhost');
});
it('valida Gmail, senha de app, nome do remetente e URL',()=>{
 const ok=getEmailConfiguration({...gmail,APP_URL:'https://familia.example'});
 expect(ok.emailConfigured).toBe(true); expect(ok.emailWarnings).toHaveLength(0);
 expect(JSON.stringify(ok)).not.toContain(gmail.GMAIL_APP_PASSWORD);
 for (const invalid of [{GMAIL_USER:'inválido'}, {GMAIL_APP_PASSWORD:'senha-normal'}, {EMAIL_FROM_NAME:'Nome\r\nBcc: outro@example.test'}, {APP_URL:'javascript:alert(1)'}]) {
   expect(getEmailConfiguration({...gmail,APP_URL:'https://familia.example',...invalid}).emailConfigured).toBe(false);
 }
});
it('exige HTTPS na hospedagem e ignora credenciais antigas do Resend',()=>{
 expect(getEmailConfiguration({...gmail,APP_URL:'http://familia.example',VERCEL:'1'}).emailConfigured).toBe(false);
 expect(getEmailConfiguration({RESEND_API_KEY:'antiga',EMAIL_FROM:'onboarding@resend.dev',APP_URL:'http://localhost:3000'}).emailConfigured).toBe(false);
});
