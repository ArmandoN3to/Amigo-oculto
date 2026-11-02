import { afterEach, expect, it, vi } from "vitest";
const createTransport = vi.hoisted(() => vi.fn());
vi.mock("nodemailer", () => ({ default: { createTransport } }));
import { createGmailTransport, gmailSender, gmailErrorMessage } from "../src/lib/gmail";
afterEach(() => { vi.unstubAllEnvs(); createTransport.mockClear(); });
it("usa somente SMTP Gmail com TLS, senha de app normalizada e remetente autenticado", () => {
 vi.stubEnv("GMAIL_USER", "familia@gmail.com"); vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
 vi.stubEnv("EMAIL_FROM_NAME", "Família"); vi.stubEnv("APP_URL", "http://localhost:3000");
 createGmailTransport();
 expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({host:"smtp.gmail.com",port:465,secure:true,auth:{user:"familia@gmail.com",pass:"abcdefghijklmnop"},disableFileAccess:true,disableUrlAccess:true}));
 expect(gmailSender()).toEqual({name:"Família",address:"familia@gmail.com"});
});
it("bloqueia configuração ausente antes de abrir conexão", () => {
 vi.stubEnv("GMAIL_USER", ""); vi.stubEnv("GMAIL_APP_PASSWORD", "");
 expect(() => createGmailTransport()).toThrow(/setup:email/); expect(createTransport).not.toHaveBeenCalled();
});
it("classifica erros sem expor credenciais ou resposta SMTP", () => {
 expect(gmailErrorMessage({code:"EAUTH",response:"segredo"})).toMatch(/autenticação/);
 expect(gmailErrorMessage({responseCode:421})).toMatch(/limitou/);
 expect(gmailErrorMessage({code:"EENVELOPE"})).toMatch(/destinatário/);
 expect(gmailErrorMessage({code:"ETIMEDOUT",response:"segredo"})).not.toContain("segredo");
 expect(gmailErrorMessage({code:"ETIMEDOUT"})).toMatch(/aceito/);
});
