import "server-only";
import { keyedHash, randomSecret, sha256, secureEqual } from "./crypto";
import { getDb, type SqlClient } from "./db";
import type { WishlistPhotoIds } from "./wishlist";

// Read the attachment positions in the same snapshot as the suggestion text.
export const wishlistPhotoIdsColumn = `COALESCE(
  (SELECT jsonb_object_agg(position, id) FROM wishlist_photos WHERE participant_id=p.id),
  '{}'::jsonb
) AS wishlist_photo_ids`;

export function participantToken(id: string, nonce: string): string {
  // A 256-bit HMAC capability can be reconstructed for e-mail retries. The
  // database stores a random nonce and the token hash, never the bearer token.
  return `${id}.${keyedHash(`participant:v1:${id}:${nonce}`)}`;
}
export function newParticipantToken(id: string) {
  const nonce = randomSecret();
  return { nonce, hash: sha256(participantToken(id, nonce)) };
}
export async function resolveParticipant(token: string, client?: SqlClient) {
  if (!/^[0-9a-f-]{36}\.[a-f0-9]{64}$/.test(token)) return null;
  const id = token.split(".")[0];
  const db = client || await getDb();
  const { rows } = await db.query<{
    id: string; event_id: string; name: string; email: string;
    wishlist_text: string; wishlist_revision: number; wishlist_photo_ids: WishlistPhotoIds;
    token_nonce: string; access_token_hash: string;
  }>(`SELECT id,event_id,name,email,wishlist_text,wishlist_revision,token_nonce,access_token_hash,
    ${wishlistPhotoIdsColumn} FROM participants p WHERE id=$1`, [id]);
  const participant = rows[0];
  if (!participant || !secureEqual(sha256(token), participant.access_token_hash) || !secureEqual(token, participantToken(participant.id, participant.token_nonce))) return null;
  return participant;
}
