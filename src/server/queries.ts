import "server-only";
import { redirect } from "next/navigation";
import { adminConfigured, getAdminSession } from "@/lib/auth";
import { getDb, storageMode, type SqlClient } from "@/lib/db";
import { getEmailConfiguration } from "@/lib/email-config";
import { resolveParticipant, wishlistPhotoIdsColumn } from "@/lib/tokens";
import type { AdminDashboard, AdminEvent, AdminParticipant, ParticipantPage, PublicEvent, RuntimeStatus } from "@/lib/types";
import { idSchema } from "@/lib/validations";
import type { WishlistPhotoIds } from "@/lib/wishlist";

type PublicEventRow = { id: string; name: string; event_date: Date | string; gift_limit: string | number | null; status: "draft" | "drawn"; participant_count: string; draw_version: number };
function eventDTO(row: PublicEventRow): PublicEvent {
  return {
    id: row.id, name: row.name,
    eventDate: row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : row.event_date.slice(0, 10),
    giftLimit: row.gift_limit === null ? null : Number(row.gift_limit),
    status: row.status, participantCount: Number(row.participant_count),
  };
}
async function readEvents(client: SqlClient): Promise<PublicEventRow[]> {
  return (await client.query<PublicEventRow>(`SELECT e.id,e.name,e.event_date::text AS event_date,e.gift_limit,e.status,e.draw_version,
    (SELECT count(*)::text FROM participants p WHERE p.event_id=e.id) AS participant_count
    FROM events e ORDER BY e.event_date DESC,e.created_at DESC`)).rows;
}
export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  return { adminConfigured: adminConfigured(), ...getEmailConfiguration(), storageMode: storageMode() };
}
export async function getPublicEvents(): Promise<PublicEvent[]> {
  return (await readEvents(await getDb())).map(eventDTO);
}
export async function getAdminDashboard(eventId?: string): Promise<AdminDashboard> {
  if (!await getAdminSession()) redirect("/admin/login");
  const db = await getDb();
  return db.transaction(async client => {
    const events = await readEvents(client);
    const requested = eventId && idSchema.safeParse(eventId).success ? eventId : undefined;
    const selected = events.find(event => event.id === requested) || events[0];
    let selectedEvent: AdminEvent | null = null;
    if (selected) {
      const participants = await client.query<{
        id: string; name: string; email: string; emoji: string; email_status: AdminParticipant["emailStatus"]; last_error: string | null; attempts: number | null;
      }>(`SELECT p.id,p.name,p.email,p.emoji,m.status AS email_status,m.last_error,m.attempts
        FROM participants p LEFT JOIN email_deliveries m ON m.participant_id=p.id
        AND m.type=$2 AND m.draw_version=$3
        WHERE p.event_id=$1 ORDER BY p.created_at,p.id`, [selected.id, selected.status === "drawn" ? "result" : "invitation", selected.status === "drawn" ? selected.draw_version : 0]);
      const exclusions = await client.query<{ giver_id: string; receiver_id: string }>("SELECT giver_id,receiver_id FROM exclusions WHERE event_id=$1", [selected.id]);
      selectedEvent = {
        ...eventDTO(selected), drawVersion: selected.draw_version,
        participants: participants.rows.map(person => ({ id: person.id, name: person.name, email: person.email, emoji: person.emoji, emailStatus: person.email_status, emailError: person.last_error, emailAttempts: person.attempts || 0 })),
        exclusions: exclusions.rows.map(rule => ({ giverId: rule.giver_id, receiverId: rule.receiver_id })),
      };
    }
    return { ...await getRuntimeStatus(), events: events.map(eventDTO), selectedEvent };
  });
}
export async function getParticipantPage(token: string): Promise<ParticipantPage | null> {
  const db = await getDb();
  return db.transaction(async client => {
    const participant = await resolveParticipant(token, client);
    if (!participant) return null;
    const events = await client.query<PublicEventRow>(`SELECT e.id,e.name,e.event_date::text AS event_date,e.gift_limit,e.status,e.draw_version,
      (SELECT count(*)::text FROM participants p WHERE p.event_id=e.id) AS participant_count FROM events e WHERE e.id=$1`, [participant.event_id]);
    const event = events.rows[0];
    if (!event) return null;
    let recipient: ParticipantPage["recipient"] = null;
    if (event.status === "drawn") {
      const result = await client.query<{ name: string; emoji: string; wishlist_text: string; wishlist_photo_ids: WishlistPhotoIds }>(`SELECT p.name,p.emoji,p.wishlist_text,${wishlistPhotoIdsColumn}
        FROM draws d JOIN participants p ON p.id=d.receiver_id
        WHERE d.event_id=$1 AND d.giver_id=$2 AND d.draw_version=$3`, [event.id, participant.id, event.draw_version]);
      const person = result.rows[0];
      if (person) {
        recipient = { name: person.name, emoji: person.emoji, wishlistText: person.wishlist_text };
        if (Object.keys(person.wishlist_photo_ids).length) recipient.photoIds = person.wishlist_photo_ids;
      }
    }
    return {
      event: eventDTO(event),
      self: {
        name: participant.name,
        wishlistText: participant.wishlist_text,
        wishlistRevision: participant.wishlist_revision,
        photoIds: participant.wishlist_photo_ids,
      },
      recipient,
    };
  });
}
