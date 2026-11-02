import nodemailer from "nodemailer";
import { getEmailConfiguration } from "./email-config";

export function createGmailTransport() {
  if (!getEmailConfiguration().emailConfigured) throw new Error("Configure GMAIL_USER, GMAIL_APP_PASSWORD e APP_URL. Execute npm run setup:email.");
  return nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: process.env.GMAIL_USER!.trim(), pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, "") },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 12_000,
    disableFileAccess: true, disableUrlAccess: true,
  });
}

export function gmailSender() {
  return { name: process.env.EMAIL_FROM_NAME?.trim() || "Amigo Oculto", address: process.env.GMAIL_USER!.trim() };
}

// SMTP responses can contain private data. Only return fixed diagnostic messages.
export function gmailErrorMessage(error: unknown): string {
  const smtp = error as { code?: string; responseCode?: number } | null;
  if (smtp?.code === "EAUTH" || smtp?.responseCode === 535) return "O Gmail recusou a autenticação. Confira GMAIL_USER e a senha de app; a senha normal da conta não funciona.";
  if (["SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "CERT_HAS_EXPIRED"].includes(smtp?.code || "")) return "Falha no certificado TLS. Configure o certificado confiável da sua rede no Node.js, mantendo a verificação TLS ativa.";
  if (smtp?.responseCode === 421 || smtp?.responseCode === 454) return "O Gmail limitou temporariamente os envios. Aguarde antes de tentar novamente.";
  if (smtp?.code === "EENVELOPE" || smtp?.responseCode === 550 || smtp?.responseCode === 553) return "O Gmail recusou o destinatário. Confira o e-mail cadastrado e os limites da conta.";
  return "Não foi possível confirmar o envio pelo Gmail. Confira a conexão e os limites da conta. Verifique Enviados antes de repetir: um envio interrompido pode ter sido aceito.";
}
