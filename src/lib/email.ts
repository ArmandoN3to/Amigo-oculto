import "server-only";
import { getEmailConfiguration } from "./email-config";
import { createGmailTransport, gmailSender, gmailErrorMessage } from "./gmail";
import { getDb } from "./db";
import { participantToken } from "./tokens";
import { lockEvent } from "@/server/service";

export function emailConfigured(): boolean { return getEmailConfiguration().emailConfigured; }
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
export interface EmailSummary { sent: number; failed: number; pending: number }

export async function dispatchEmails(eventId: string): Promise<EmailSummary> {
  const db = await getDb();
  const summary: EmailSummary = { sent: 0, failed: 0, pending: 0 };
  if (!emailConfigured()) {
    const waiting = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM email_deliveries m JOIN events e ON e.id=m.event_id
      WHERE m.event_id=$1 AND m.status IN ('pending','failed') AND ((e.status='draft' AND m.type='invitation') OR (e.status='drawn' AND m.type='result' AND m.draw_version=e.draw_version))`, [eventId]);
    summary.pending = Number(waiting.rows[0].count);
    return summary;
  }
  // Await pairs of requests in parallel, with a limited dispatch window. A normal
  // family-sized event is handled in one action. Remaining deliveries persist
  // for the explicit retry button; no unawaited serverless background work.
  const transport = createGmailTransport();
  const deadline = Date.now() + 32_000;
  const attempted: string[] = [];
  while (Date.now() < deadline) {
    const batchStarted = Date.now();
    const states = await db.transaction(async client => {
      const event = await lockEvent(client, eventId);
      const { rows } = await client.query<{
        id: string; type: "invitation" | "result"; draw_version: number; status: string;
        participant_id: string; name: string; email: string; token_nonce: string; receiver_name: string | null;
      }>(`SELECT m.id,m.type,m.draw_version,m.status,p.id AS participant_id,p.name,p.email,p.token_nonce,r.name AS receiver_name
        FROM email_deliveries m JOIN participants p ON p.id=m.participant_id
        LEFT JOIN draws d ON d.event_id=m.event_id AND d.giver_id=p.id
        LEFT JOIN participants r ON r.id=d.receiver_id
        WHERE m.event_id=$1 AND m.status IN ('pending','failed') AND NOT(m.id=ANY($2::text[]))
        AND (($3='draft' AND m.type='invitation') OR ($3='drawn' AND m.type='result' AND m.draw_version=$4))
        ORDER BY CASE WHEN m.status='pending' THEN 0 ELSE 1 END,m.created_at,m.id LIMIT 2 FOR UPDATE OF m`, [eventId, attempted, event.status, event.draw_version]);
      return Promise.all(rows.map(async delivery => {
      attempted.push(delivery.id);
      if (!delivery || delivery.status === "sent" || (delivery.type === "result" && (event.status !== "drawn" || delivery.draw_version !== event.draw_version)) || (delivery.type === "invitation" && event.status !== "draft")) return "skipped";
      await client.query("UPDATE email_deliveries SET attempts=attempts+1 WHERE id=$1", [delivery.id]);
      const configError = "Configure GMAIL_USER, GMAIL_APP_PASSWORD e APP_URL para enviar e-mails pelo Gmail.";
      if (!emailConfigured()) {
        await client.query("UPDATE email_deliveries SET status='failed',last_error=$2 WHERE id=$1", [delivery.id, configError]);
        return "failed";
      }
      try {
        const baseUrl = new URL(process.env.APP_URL!);
        if (!["https:", "http:"].includes(baseUrl.protocol)) throw new Error("Invalid APP_URL");
        if (process.env.VERCEL && baseUrl.protocol !== "https:") throw new Error("HTTPS required");
        const link = new URL(`/participante/${participantToken(delivery.participant_id, delivery.token_nonce)}`, baseUrl).toString();
        const subject = delivery.type === "result" ? `${event.name}: seu amigo oculto foi sorteado` : `${event.name}: preencha sua lista de presentes`;
        const resultText = delivery.type === "result" ? `Sorteio nº ${event.draw_version}. Se o organizador refizer o sorteio, o novo resultado substitui este.\n\n` : "Conte o que gostaria de ganhar antes do nosso encontro.\n\n";
        const text = `Olá, ${delivery.name}!\n\n${resultText}Acesse sua página individual para ver as sugestões e atualizar sua lista:\n${link}\n\nNão compartilhe este link: ele dá acesso à sua participação.\n${event.name}`;
        const result = await transport.sendMail({
          from: gmailSender(), to: [delivery.email], subject, text,
          messageId: `<family-gift.${delivery.id}@gmail.com>`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#183d32;line-height:1.6"><h1 style="font-size:24px">${escapeHtml(event.name)}</h1><p>Olá, ${escapeHtml(delivery.name)}!</p>${delivery.type === "result" ? `<p>Sorteio nº ${event.draw_version}. Um novo sorteio substitui os resultados anteriores.</p>` : "<p>Conte o que gostaria de ganhar na sua lista de presentes.</p>"}<p><a href="${escapeHtml(link)}" style="color:#166044">Acessar minha página individual</a></p><p style="font-size:13px">Guarde seu link em segredo: ele permite consultar seu resultado e editar sua lista.</p></div>`
        });
        if (!result.accepted?.length) throw new Error("SMTP did not accept the recipient");
        await client.query("UPDATE email_deliveries SET status='sent',provider_id=$2,sent_at=$3,last_error=NULL WHERE id=$1", [delivery.id, result.messageId, new Date().toISOString()]);
        return "sent";
      } catch (error) {
        await client.query("UPDATE email_deliveries SET status='failed',last_error=$2 WHERE id=$1", [delivery.id, gmailErrorMessage(error)]);
        return "failed";
      }
      }));
    });
    if (!states.length) break;
    for (const state of states) {
      if (state === "sent") summary.sent++;
      if (state === "failed") summary.failed++;
    }
    if (emailConfigured()) await new Promise(resolve => setTimeout(resolve, Math.max(0, 1_050 - (Date.now() - batchStarted))));
  }
  const remaining = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM email_deliveries m JOIN events e ON e.id=m.event_id
    WHERE m.event_id=$1 AND m.status='pending' AND ((e.status='draft' AND m.type='invitation') OR (e.status='drawn' AND m.type='result' AND m.draw_version=e.draw_version))`, [eventId]);
  summary.pending = Number(remaining.rows[0].count);
  return summary;
}
