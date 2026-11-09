"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, signIn, signOut } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dispatchEmails, emailConfigured, type EmailSummary } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import { resolveParticipant } from "@/lib/tokens";
import { hasOnlyShortNewSuggestions, wishlistItems, WISHLIST_MAX_PHOTOS } from "@/lib/wishlist";
import { readWishlistPhoto } from "@/lib/wishlist-photo-upload";
import type { ActionResult } from "@/lib/types";
import { participantEmojiSchema, deleteParticipantSchema, drawSchema, eventIdSchema, eventSchema, exclusionSchema, loginSchema, participantSchema, wishlistSchema } from "@/lib/validations";
import { confirmDraw, deleteParticipant, prepareInvitations, regenerateLink, saveEvent, saveExclusion, saveParticipant } from "./service";

function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, message: "Confira os campos informados.", fieldErrors: error.flatten().fieldErrors as Record<string, string[]> };
  if (error instanceof AppError) return { ok: false, message: error.message };
  // PostgreSQL constraint errors are safe to classify without returning SQL,
  // connection strings, personal data, or raw provider/internal error messages.
  if (typeof error === "object" && error && "code" in error && error.code === "23505") return { ok: false, message: "Já existe um cadastro com esses dados neste evento." };
  return { ok: false, message: "Não foi possível concluir. Confira a configuração local e tente novamente." };
}
function refreshAdmin(): void { revalidatePath("/admin"); revalidatePath("/"); }
function deliveryMessage(summary: EmailSummary): string {
  const parts = [`${summary.sent} e-mail(s) enviado(s)`];
  if (summary.failed) parts.push(`${summary.failed} falha(s)`);
  if (summary.pending) parts.push(`${summary.pending} pendente(s); use Reenviar pendentes para continuar`);
  if (!emailConfigured()) parts.push("Configure GMAIL_USER, GMAIL_APP_PASSWORD e APP_URL para os envios reais");
  return `${parts.join(". ")}.`;
}

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult> {
  try { const data = loginSchema.parse(input); await signIn(data.email, data.password); return { ok: true, message: "Acesso liberado." }; }
  catch (error) { return failure(error); }
}
export async function logoutAction(): Promise<ActionResult> {
  try { await signOut(); return { ok: true, message: "Você saiu da área do organizador." }; }
  catch (error) { return failure(error); }
}
export async function saveEventAction(input: z.infer<typeof eventSchema>): Promise<ActionResult> {
  try { await requireAdmin(); const eventId = await saveEvent(eventSchema.parse(input)); refreshAdmin(); return { ok: true, message: "Evento salvo.", eventId }; }
  catch (error) { return failure(error); }
}
export async function saveParticipantAction(input: z.infer<typeof participantSchema>): Promise<ActionResult> {
  try { await requireAdmin(); await saveParticipant(participantSchema.parse(input)); refreshAdmin(); return { ok: true, message: "Participante salvo." }; }
  catch (error) { return failure(error); }
}
export async function deleteParticipantAction(input: z.infer<typeof deleteParticipantSchema>): Promise<ActionResult> {
  try { await requireAdmin(); const data = deleteParticipantSchema.parse(input); await deleteParticipant(data.eventId, data.participantId); refreshAdmin(); return { ok: true, message: "Participante removido." }; }
  catch (error) { return failure(error); }
}
export async function saveExclusionAction(input: z.infer<typeof exclusionSchema>): Promise<ActionResult> {
  try { await requireAdmin(); const data = exclusionSchema.parse(input); await saveExclusion(data.eventId, data.giverId, data.receiverId, data.remove); refreshAdmin(); return { ok: true, message: data.remove ? "Restrição removida." : "Restrição adicionada." }; }
  catch (error) { return failure(error); }
}
export async function drawAction(input: z.infer<typeof drawSchema>): Promise<ActionResult> {
  try {
    await requireAdmin(); const data = drawSchema.parse(input);
    const result = await confirmDraw(data.eventId, data.redraw, data.expectedDrawVersion);
    // Draw is committed before any external communication. An accidental
    // second submit never changes already persisted pairs.
    let deliveryStatus: string;
    try { deliveryStatus = deliveryMessage(await dispatchEmails(data.eventId)); }
    catch { deliveryStatus = "O envio foi interrompido, mas o sorteio permanece salvo. Use Enviar pendentes e tentar falhas para retomar sem refazer o sorteio."; }
    refreshAdmin(); revalidatePath("/participante/[token]", "page");
    return { ok: true, message: `${result.alreadyDrawn ? "O sorteio existente foi preservado." : "Sorteio salvo com segurança."} ${deliveryStatus}` };
  } catch (error) { return failure(error); }
}
export async function sendInvitesAction(input: { eventId: string }): Promise<ActionResult> {
  try { await requireAdmin(); const data = eventIdSchema.parse(input); await prepareInvitations(data.eventId); const summary = await dispatchEmails(data.eventId); refreshAdmin(); return { ok: true, message: deliveryMessage(summary) }; }
  catch (error) { return failure(error); }
}
export async function retryEmailsAction(input: { eventId: string }): Promise<ActionResult> {
  try { await requireAdmin(); const data = eventIdSchema.parse(input); const summary = await dispatchEmails(data.eventId); refreshAdmin(); return { ok: true, message: deliveryMessage(summary) }; }
  catch (error) { return failure(error); }
}
export async function regenerateParticipantLinkAction(input: { eventId: string; participantId: string }): Promise<ActionResult> {
  try { await requireAdmin(); const data = deleteParticipantSchema.parse(input); await regenerateLink(data.eventId, data.participantId); const summary = await dispatchEmails(data.eventId); refreshAdmin(); revalidatePath("/participante/[token]", "page"); return { ok: true, message: `O link anterior foi invalidado. ${deliveryMessage(summary)}` }; }
  catch (error) { return failure(error); }
}
export async function saveWishlistAction(input: z.infer<typeof wishlistSchema>, upload?: FormData): Promise<ActionResult> {
  try {
    const data = wishlistSchema.parse(input);
    const participant = await resolveParticipant(data.token);
    if (!participant) throw new AppError("Este link é inválido ou foi substituído. Peça um novo link ao organizador.");
    const conflictMessage = "Suas sugestões foram alteradas em outra página. Atualize esta página antes de tentar novamente.";
    if (data.expectedWishlistText !== undefined && data.expectedWishlistText !== participant.wishlist_text) throw new AppError(conflictMessage);
    if (data.expectedRevision !== undefined && data.expectedRevision !== participant.wishlist_revision) throw new AppError(conflictMessage);
    if (!hasOnlyShortNewSuggestions(data.wishlistText, participant.wishlist_text)) throw new AppError("Cada nova sugestão precisa ter até 120 caracteres.");

    const items = wishlistItems(participant.wishlist_text);
    const file = upload?.get("photo") ?? null;
    const photos = participant.wishlist_photo_ids;
    const photoCount = Object.keys(photos).length;
    const { removedIndex, photoIndex } = data;
    const nextItems = wishlistItems(data.wishlistText);
    const appending = nextItems.length === items.length + 1 && items.every((item, index) => item === nextItems[index]);
    if (removedIndex !== undefined) {
      if (file !== null || photoIndex !== undefined || removedIndex >= items.length
        || data.wishlistText !== items.filter((_, index) => index !== removedIndex).join("\n")) throw new AppError(conflictMessage);
    } else if (photoIndex !== undefined) {
      if (file === null || !items[photoIndex] || photos[photoIndex]
        || data.wishlistText !== participant.wishlist_text) throw new AppError(conflictMessage);
    } else if ((file !== null && !appending)
      || (photoCount && !appending && data.wishlistText !== participant.wishlist_text)) {
      throw new AppError(conflictMessage);
    }
    if (file !== null && photoCount >= WISHLIST_MAX_PHOTOS) {
      throw new AppError(`Você pode guardar até ${WISHLIST_MAX_PHOTOS} fotos na sua lista.`);
    }
    await consumeRateLimit(`wishlist:${participant.id}`, 60, 1);
    const photo = file === null ? null : await readWishlistPhoto(file);
    await (await getDb()).transaction(async client => {
      const changed = await client.query(`UPDATE participants SET wishlist_text=$2,wishlist_revision=wishlist_revision+1
        WHERE id=$1 AND access_token_hash=$3 AND wishlist_revision=$4 AND wishlist_text=$5 RETURNING id`,
      [participant.id, data.wishlistText, participant.access_token_hash, participant.wishlist_revision, participant.wishlist_text]);
      if (!changed.rows.length) throw new AppError(conflictMessage);
      if (removedIndex !== undefined && photoCount) {
        await client.query("DELETE FROM wishlist_photos WHERE participant_id=$1 AND position=$2", [participant.id, removedIndex]);
        await client.query("UPDATE wishlist_photos SET position=position-1 WHERE participant_id=$1 AND position>$2", [participant.id, removedIndex]);
      }
      if (photo) {
        await client.query("INSERT INTO wishlist_photos(id,participant_id,position,content) VALUES ($1,$2,$3,$4)",
          [randomUUID(), participant.id, photoIndex ?? items.length, photo]);
      }
    });
    revalidatePath("/participante/[token]", "page");
    return { ok: true, message: "Sua lista de presentes foi salva." };
  } catch (error) { return failure(error); }
}

export async function saveParticipantEmojiAction(input: z.infer<typeof participantEmojiSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = participantEmojiSchema.parse(input);
    const changed = await (await getDb()).query("UPDATE participants SET emoji=$3 WHERE id=$1 AND event_id=$2 RETURNING id", [data.participantId, data.eventId, data.emoji]);
    if (!changed.rows.length) throw new AppError("Participante não encontrado.");
    refreshAdmin(); revalidatePath("/participante/[token]", "page");
    return { ok: true, message: "Emoji salvo." };
  } catch (error) { return failure(error); }
}
