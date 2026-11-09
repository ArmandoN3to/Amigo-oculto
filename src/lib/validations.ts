import { isSingleEmoji } from "./emoji";
import { z } from "zod";
import { WISHLIST_MAX_LENGTH } from "./wishlist";

export const idSchema = z.string().uuid("Identificador inválido.");
const name = z.string().trim().min(1, "Informe o nome.").max(120, "Use até 120 caracteres.");
export const loginSchema = z.object({ email: z.string().trim().email("Informe um e-mail válido.").max(254), password: z.string().min(1, "Informe a senha.").max(256) });
export const eventSchema = z.object({
  id: idSchema.optional(), name,
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine(value => {
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "Informe uma data válida."),
  giftLimit: z.number().finite().min(0).max(9_999_999_999).nullable().optional(),
  copyFromEventId: idSchema.optional(),
});
export const emojiSchema = z.string().trim().max(32).refine(value => !value || isSingleEmoji(value), "Escolha apenas um emoji.");
export const participantEmojiSchema = z.object({ eventId: idSchema, participantId: idSchema, emoji: emojiSchema });
export const participantSchema = z.object({ eventId: idSchema, id: idSchema.optional(), name, emoji: emojiSchema.optional(), email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254) });
export const deleteParticipantSchema = z.object({ eventId: idSchema, participantId: idSchema });
export const exclusionSchema = z.object({ eventId: idSchema, giverId: idSchema, receiverId: idSchema, remove: z.boolean().optional() });
export const drawSchema = z.object({ eventId: idSchema, redraw: z.boolean().optional(), expectedDrawVersion: z.number().int().min(0).optional() });
export const eventIdSchema = z.object({ eventId: idSchema });
export const wishlistSchema = z.object({
  token: z.string().max(160),
  wishlistText: z.string().max(WISHLIST_MAX_LENGTH, "Use até 5.000 caracteres na lista."),
  expectedWishlistText: z.string().max(WISHLIST_MAX_LENGTH).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
  removedIndex: z.number().int().nonnegative().optional(),
  photoIndex: z.number().int().nonnegative().optional(),
});
