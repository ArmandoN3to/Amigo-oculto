import "server-only";
import { randomUUID } from "node:crypto";
import { getDb, type SqlClient } from "@/lib/db";
import { makeDraw } from "@/lib/draw";
import { AppError } from "@/lib/errors";
import { newParticipantToken } from "@/lib/tokens";
import type { z } from "zod";
import type { eventSchema, participantSchema } from "@/lib/validations";

export type EventRow = { id: string; name: string; event_date: string | Date; gift_limit: string | number | null; status: "draft" | "drawn"; draw_version: number };

export async function lockEvent(client: SqlClient, eventId: string): Promise<EventRow> {
  const { rows } = await client.query<EventRow>("SELECT * FROM events WHERE id=$1 FOR UPDATE", [eventId]);
  if (!rows[0]) throw new AppError("Evento não encontrado.", "NOT_FOUND");
  return rows[0];
}
export function requireDraft(event: EventRow): void {
  if (event.status !== "draft") throw new AppError("O sorteio já foi realizado. Participantes e restrições ficam bloqueados para preservar o resultado.");
}

async function insertParticipant(client: SqlClient, eventId: string, name: string, email: string, emoji = ""): Promise<string> {
  const id = randomUUID(); const token = newParticipantToken(id);
  await client.query("INSERT INTO participants(id,event_id,name,email,token_nonce,access_token_hash,emoji) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, eventId, name, email, token.nonce, token.hash, emoji]);
  return id;
}

export async function saveEvent(input: z.infer<typeof eventSchema>): Promise<string> {
  const db = await getDb();
  return db.transaction(async client => {
    const id = input.id || randomUUID();
    if (input.id) {
      requireDraft(await lockEvent(client, id));
      await client.query("UPDATE events SET name=$2,event_date=$3,gift_limit=$4 WHERE id=$1", [id, input.name, input.eventDate, input.giftLimit ?? null]);
    } else {
      await client.query("INSERT INTO events(id,name,event_date,gift_limit) VALUES($1,$2,$3,$4)", [id, input.name, input.eventDate, input.giftLimit ?? null]);
      if (input.copyFromEventId) {
        await lockEvent(client, input.copyFromEventId);
        const source = await client.query<{ id: string; name: string; email: string; emoji: string }>("SELECT id,name,email,emoji FROM participants WHERE event_id=$1 ORDER BY created_at,id", [input.copyFromEventId]);
        for (const participant of source.rows) await insertParticipant(client, id, participant.name, participant.email, participant.emoji);
      }
    }
    return id;
  });
}

export async function saveParticipant(input: z.infer<typeof participantSchema>): Promise<void> {
  await (await getDb()).transaction(async client => {
    requireDraft(await lockEvent(client, input.eventId));
    const duplicate = await client.query("SELECT id FROM participants WHERE event_id=$1 AND email=$2 AND id<>$3", [input.eventId, input.email, input.id || ""]);
    if (duplicate.rows.length) throw new AppError("Este e-mail já está cadastrado neste evento.");
    if (input.id) {
      const current = await client.query<{ email: string }>("SELECT email FROM participants WHERE id=$1 AND event_id=$2", [input.id, input.eventId]);
      if (!current.rows[0]) throw new AppError("Participante não encontrado.");
      if (current.rows[0].email !== input.email) {
        const token = newParticipantToken(input.id);
        await client.query("UPDATE participants SET name=$3,email=$4,token_nonce=$5,access_token_hash=$6 ,emoji=COALESCE($7,emoji) WHERE id=$1 AND event_id=$2", [input.id, input.eventId, input.name, input.email, token.nonce, token.hash, input.emoji ?? null]);
        await client.query("DELETE FROM email_deliveries WHERE participant_id=$1", [input.id]);
      } else {
        await client.query("UPDATE participants SET name=$3,emoji=COALESCE($4,emoji) WHERE id=$1 AND event_id=$2", [input.id, input.eventId, input.name, input.emoji ?? null]);
        await client.query("DELETE FROM email_deliveries WHERE participant_id=$1", [input.id]);
      }
    } else await insertParticipant(client, input.eventId, input.name, input.email, input.emoji);
  });
}

export async function deleteParticipant(eventId: string, participantId: string): Promise<void> {
  await (await getDb()).transaction(async client => {
    requireDraft(await lockEvent(client, eventId));
    const deleted = await client.query("DELETE FROM participants WHERE id=$1 AND event_id=$2 RETURNING id", [participantId, eventId]);
    if (!deleted.rows.length) throw new AppError("Participante não encontrado.");
  });
}

export async function saveExclusion(eventId: string, giverId: string, receiverId: string, remove = false): Promise<void> {
  if (giverId === receiverId) throw new AppError("Ninguém tira a si mesmo; essa regra já é automática.");
  await (await getDb()).transaction(async client => {
    requireDraft(await lockEvent(client, eventId));
    const people = await client.query("SELECT id FROM participants WHERE event_id=$1 AND id IN ($2,$3)", [eventId, giverId, receiverId]);
    if (people.rows.length !== 2) throw new AppError("Selecione dois participantes deste evento.");
    if (remove) await client.query("DELETE FROM exclusions WHERE event_id=$1 AND giver_id=$2 AND receiver_id=$3", [eventId, giverId, receiverId]);
    else await client.query("INSERT INTO exclusions(event_id,giver_id,receiver_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [eventId, giverId, receiverId]);
  });
}

export async function confirmDraw(eventId: string, redraw = false, expectedDrawVersion?: number): Promise<{ alreadyDrawn: boolean }> {
  return (await getDb()).transaction(async client => {
    const event = await lockEvent(client, eventId);
    if (event.status === "drawn" && !redraw) return { alreadyDrawn: true };
    if (event.status !== "drawn" && redraw) throw new AppError("Ainda não existe um sorteio para refazer.");
    if (redraw && expectedDrawVersion !== event.draw_version) throw new AppError("O sorteio já mudou. Atualize a página e confira o resultado da operação antes de refazer novamente.");
    const people = await client.query<{ id: string }>("SELECT id FROM participants WHERE event_id=$1 ORDER BY id", [eventId]);
    const exclusions = await client.query<{ giver_id: string; receiver_id: string }>("SELECT giver_id,receiver_id FROM exclusions WHERE event_id=$1", [eventId]);
    const pairs = makeDraw(people.rows.map(person => person.id), exclusions.rows.map(pair => ({ giverId: pair.giver_id, receiverId: pair.receiver_id })));
    const version = event.draw_version + 1;
    await client.query("DELETE FROM draws WHERE event_id=$1", [eventId]);
    await client.query("DELETE FROM email_deliveries WHERE event_id=$1 AND type='result'", [eventId]);
    for (const pair of pairs) {
      await client.query("INSERT INTO draws(event_id,giver_id,receiver_id,draw_version) VALUES($1,$2,$3,$4)", [eventId, pair.giverId, pair.receiverId, version]);
      await client.query("INSERT INTO email_deliveries(id,event_id,participant_id,type,draw_version) VALUES($1,$2,$3,'result',$4)", [randomUUID(), eventId, pair.giverId, version]);
    }
    await client.query("UPDATE events SET status='drawn',draw_version=$2 WHERE id=$1", [eventId, version]);
    return { alreadyDrawn: false };
  });
}

export async function prepareInvitations(eventId: string): Promise<void> {
  await (await getDb()).transaction(async client => {
    requireDraft(await lockEvent(client, eventId));
    const people = await client.query<{ id: string }>("SELECT id FROM participants WHERE event_id=$1", [eventId]);
    if (!people.rows.length) throw new AppError("Cadastre os participantes antes de enviar convites.");
    for (const person of people.rows) {
      await client.query(`INSERT INTO email_deliveries(id,event_id,participant_id,type,draw_version) VALUES($1,$2,$3,'invitation',0)
        ON CONFLICT(participant_id,type,draw_version) DO UPDATE SET
        id=CASE WHEN email_deliveries.status='sent' THEN EXCLUDED.id ELSE email_deliveries.id END,
        status='pending',last_error=NULL`, [randomUUID(), eventId, person.id]);
    }
  });
}

export async function regenerateLink(eventId: string, participantId: string): Promise<void> {
  await (await getDb()).transaction(async client => {
    const event = await lockEvent(client, eventId);
    const token = newParticipantToken(participantId);
    const changed = await client.query("UPDATE participants SET token_nonce=$3,access_token_hash=$4 WHERE id=$1 AND event_id=$2 RETURNING id", [participantId, eventId, token.nonce, token.hash]);
    if (!changed.rows.length) throw new AppError("Participante não encontrado.");
    const type = event.status === "drawn" ? "result" : "invitation";
    await client.query(`INSERT INTO email_deliveries(id,event_id,participant_id,type,draw_version) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(participant_id,type,draw_version) DO UPDATE SET id=EXCLUDED.id,status='pending',last_error=NULL,provider_id=NULL,sent_at=NULL`,
    [randomUUID(), eventId, participantId, type, event.status === "drawn" ? event.draw_version : 0]);
  });
}
