import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const smtpSend = vi.hoisted(() => vi.fn());
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail: smtpSend, close: vi.fn() })) } }));

const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined, set: (name: string, value: string) => cookieJar.set(name, value), delete: (name: string) => cookieJar.delete(name) }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));

import { getDb, closeDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/crypto";
import { participantToken, resolveParticipant } from "../src/lib/tokens";
import { dispatchEmails } from "../src/lib/email";
import { getAdminSession } from "../src/lib/auth";
import { confirmDraw, saveEvent, saveParticipant, saveExclusion } from "../src/server/service";
import { getAdminDashboard, getParticipantPage } from "../src/server/queries";
import { loginAction, saveEventAction, saveParticipantAction, saveWishlistAction, deleteParticipantAction, saveExclusionAction, drawAction, sendInvitesAction, retryEmailsAction, regenerateParticipantLinkAction, saveParticipantEmojiAction } from "../src/server/actions";

process.env.AUTH_SECRET = "test-secret-only-for-isolated-in-memory-tests-123456";
process.env.LOCAL_DATABASE_DIR = ":memory:";
delete process.env.DATABASE_URL;
delete process.env.VERCEL;
delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD;
delete process.env.EMAIL_FROM;

beforeEach(async () => {
  cookieJar.clear(); vi.unstubAllGlobals(); smtpSend.mockReset();
  delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD; delete process.env.EMAIL_FROM;
  const db = await getDb();
  await db.query("DELETE FROM events");
  await db.query("DELETE FROM admin_sessions");
  await db.query("DELETE FROM rate_limits");
  process.env.ADMIN_EMAIL = "organizador@example.test";
  process.env.ADMIN_PASSWORD_HASH = await hashPassword("senha-de-teste-comprida");
});
afterAll(async () => { vi.unstubAllGlobals(); await closeDb(); });

async function family(size = 3) {
  const eventId = await saveEvent({ name: "Natal da família", eventDate: "2026-12-25", giftLimit: 100 });
  for (let index = 0; index < size; index++) await saveParticipant({ eventId, name: `Pessoa ${index}`, email: `pessoa${index}@example.test` });
  const people = (await (await getDb()).query<{ id: string; token_nonce: string }>("SELECT id,token_nonce FROM participants WHERE event_id=$1 ORDER BY email", [eventId])).rows;
  return { eventId, people };
}

describe("autorização e privacidade", () => {
  it("recusa cada mutação administrativa enviada diretamente sem sessão", async () => {
    const eventId = randomUUID(); const participantId = randomUUID();
    const calls = [
      saveEventAction({ name: "Sem sessão", eventDate: "2026-12-25" }),
      saveParticipantAction({ eventId, name: "Pessoa", email: "pessoa@example.test" }),
      deleteParticipantAction({ eventId, participantId }),
      saveExclusionAction({ eventId, giverId: participantId, receiverId: randomUUID() }),
      drawAction({ eventId }), sendInvitesAction({ eventId }), retryEmailsAction({ eventId }),
      regenerateParticipantLinkAction({ eventId, participantId }),
      saveParticipantEmojiAction({ eventId, participantId, emoji: "💀" }),
    ];
    for (const result of await Promise.all(calls)) { expect(result.ok).toBe(false); expect(result.message).toMatch(/Entre na área/); }
  });
  it("recusa operação administrativa sem sessão, valida senha, cria e revoga sessão no banco", async () => {
    expect((await saveEventAction({ name: "Sem sessão", eventDate: "2026-12-25" })).ok).toBe(false);
    await expect(getAdminDashboard()).rejects.toThrow("REDIRECT:/admin/login");
    expect((await loginAction({ email: process.env.ADMIN_EMAIL!, password: "senha-incorreta" })).ok).toBe(false);
    expect((await loginAction({ email: process.env.ADMIN_EMAIL!, password: "senha-de-teste-comprida" })).ok).toBe(true);
    expect(await getAdminSession()).toEqual({ email: process.env.ADMIN_EMAIL });
    await (await getDb()).query("DELETE FROM admin_sessions");
    expect(await getAdminSession()).toBe(null);
  });
  it("limita tentativas de login com contagem persistida", async () => {
    for (let attempt = 0; attempt < 8; attempt++) await loginAction({ email: process.env.ADMIN_EMAIL!, password: "incorreta" });
    const limited = await loginAction({ email: process.env.ADMIN_EMAIL!, password: "senha-de-teste-comprida" });
    expect(limited.ok).toBe(false); expect(limited.message).toMatch(/Muitas tentativas/);
  });
  it("limita a página individual e impede editar outra lista ou reutilizar token revogado", async () => {
    const { eventId, people } = await family();
    const token = participantToken(people[0].id, people[0].token_nonce);
    expect(await getParticipantPage(`${token.slice(0, -1)}x`)).toBe(null);
    expect((await saveWishlistAction({ token, wishlistText: "Livro e chocolate" })).ok).toBe(true);
    await confirmDraw(eventId);
    const page = await getParticipantPage(token);
    expect(page?.self.wishlistText).toBe("Livro e chocolate");
    expect(Object.keys(page!.recipient!).sort()).toEqual(["emoji", "name", "wishlistText"]);
    expect(JSON.stringify(page)).not.toContain("@example.test");
    await (await getDb()).query("UPDATE participants SET access_token_hash=$2 WHERE id=$1", [people[0].id, randomUUID()]);
    expect(await resolveParticipant(token)).toBe(null);
    expect((await saveWishlistAction({ token, wishlistText: "Alteração indevida" })).ok).toBe(false);
  });
});

describe("sugestões individuais curtas", () => {
  it("salva itens separados, remove e rejeita novos itens longos ou uma aba desatualizada", async () => {
    const { people } = await family();
    const token = participantToken(people[0].id, people[0].token_nonce);
    const first = "Camiseta azul, tamanho M";
    const second = "Chocolate meio amargo";
    expect((await saveWishlistAction({ token, wishlistText: first, expectedWishlistText: "" })).ok).toBe(true);
    expect((await saveWishlistAction({ token, wishlistText: `${first}\n${second}`, expectedWishlistText: first })).ok).toBe(true);
    const stale = await saveWishlistAction({ token, wishlistText: "Outra ideia", expectedWishlistText: first });
    expect(stale.ok).toBe(false);
    expect(stale.message).toMatch(/outra página/);
    const tooLong = await saveWishlistAction({ token, wishlistText: `${first}\n${"x".repeat(121)}` });
    expect(tooLong.ok).toBe(false);
    expect(tooLong.message).toMatch(/120/);
    expect((await getParticipantPage(token))?.self.wishlistText).toBe(`${first}\n${second}`);
    expect((await saveWishlistAction({ token, wishlistText: second, expectedWishlistText: `${first}\n${second}` })).ok).toBe(true);
    expect((await getParticipantPage(token))?.self.wishlistText).toBe(second);
    expect((await saveWishlistAction({ token, wishlistText: "", expectedWishlistText: second })).ok).toBe(true);
    expect((await getParticipantPage(token))?.self.wishlistText).toBe("");
    const concurrent = await Promise.all([
      saveWishlistAction({ token, wishlistText: "x".repeat(120), expectedWishlistText: "" }),
      saveWishlistAction({ token, wishlistText: "Outra opção", expectedWishlistText: "" }),
    ]);
    expect(concurrent.filter(result => result.ok)).toHaveLength(1);
    expect(["x".repeat(120), "Outra opção"]).toContain((await getParticipantPage(token))?.self.wishlistText);
  });

  it("preserva textos legados longos sem permitir duplicá-los ou exceder o total", async () => {
    const { people } = await family();
    const person = people[0];
    const token = participantToken(person.id, person.token_nonce);
    const legacy = "Texto antigo ".repeat(30).trim();
    await (await getDb()).query("UPDATE participants SET wishlist_text=$2 WHERE id=$1", [person.id, legacy]);
    expect((await saveWishlistAction({ token, wishlistText: `${legacy}\nLivro de aventura`, expectedWishlistText: legacy })).ok).toBe(true);
    expect((await saveWishlistAction({ token, wishlistText: `${legacy}\n${legacy}` })).ok).toBe(false);
    expect((await getParticipantPage(token))?.self.wishlistText).toBe(`${legacy}\nLivro de aventura`);
    expect((await saveWishlistAction({ token, wishlistText: "a\n".repeat(2501) })).ok).toBe(false);
    expect((await saveWishlistAction({ token, wishlistText: "Livro de aventura" })).ok).toBe(true);
    expect((await getParticipantPage(token))?.self.wishlistText).toBe("Livro de aventura");
    expect((await saveWishlistAction({ token, wishlistText: legacy })).ok).toBe(false);
  });
});

describe("persistência do sorteio e envio", () => {
  it("faz commit único, rejeita edição posterior e preserva pares no reenvio sem configuração", async () => {
    const { eventId, people } = await family();
    await saveExclusion(eventId, people[0].id, people[1].id);
    await Promise.all([confirmDraw(eventId), confirmDraw(eventId)]);
    const db = await getDb();
    const before = (await db.query("SELECT giver_id,receiver_id FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows;
    expect(before).toHaveLength(3);
    expect(before.some(pair => pair.giver_id === people[0].id && pair.receiver_id === people[1].id)).toBe(false);
    await expect(saveParticipant({ eventId, name: "Extra", email: "extra@example.test" })).rejects.toThrow(/bloqueados/);
    const summary = await dispatchEmails(eventId);
    expect(summary).toEqual({ sent: 0, failed: 0, pending: 3 });
    expect((await db.query("SELECT giver_id,receiver_id FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows).toEqual(before);
    expect((await db.query("SELECT attempts,status FROM email_deliveries WHERE event_id=$1", [eventId])).rows.every(row => row.attempts === 0 && row.status === "pending")).toBe(true);
    await expect(confirmDraw(eventId, true, 0)).rejects.toThrow(/já mudou/);
    await confirmDraw(eventId, true, 1);
    expect((await db.query("SELECT draw_version FROM events WHERE id=$1", [eventId])).rows[0].draw_version).toBe(2);
  });
  it("não grava pares ou mensagens quando as restrições tornam o sorteio impossível", async () => {
    const { eventId, people } = await family(2);
    await saveExclusion(eventId, people[0].id, people[1].id);
    await expect(confirmDraw(eventId)).rejects.toThrow(/Não é possível/);
    const db = await getDb();
    expect((await db.query("SELECT * FROM draws WHERE event_id=$1", [eventId])).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM email_deliveries WHERE event_id=$1", [eventId])).rows).toHaveLength(0);
    expect((await db.query("SELECT status FROM events WHERE id=$1", [eventId])).rows[0].status).toBe("draft");
  });
  it("copia só nome/e-mail para evento independente com tokens novos", async () => {
    const { eventId, people } = await family();
    await saveExclusion(eventId, people[0].id, people[1].id);
    await saveWishlistAction({ token: participantToken(people[0].id, people[0].token_nonce), wishlistText: "Lista antiga" });
    await confirmDraw(eventId);
    const nextId = await saveEvent({ name: "Natal seguinte", eventDate: "2027-12-25", copyFromEventId: eventId });
    const db = await getDb();
    const next = (await db.query("SELECT id,wishlist_text FROM participants WHERE event_id=$1", [nextId])).rows;
    expect(next).toHaveLength(3);
    expect(next.every(person => person.wishlist_text === "" && !people.some(old => old.id === person.id))).toBe(true);
    expect((await db.query("SELECT * FROM exclusions WHERE event_id=$1", [nextId])).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM draws WHERE event_id=$1", [nextId])).rows).toHaveLength(0);
  });
  it("faz envio aguardado com resultado, falha rastreada e reenvio com identificador estável sem trocar pares", async () => {
    const { eventId } = await family();
    await confirmDraw(eventId);
    process.env.GMAIL_USER = "familia@gmail.com"; process.env.GMAIL_APP_PASSWORD = "abcdefghijklmnop"; process.env.EMAIL_FROM = "Familia <familia@example.test>"; process.env.APP_URL = "http://localhost:3000";
    let first = true;
    const requests: { body: Record<string, unknown>; key: string }[] = [];
    smtpSend.mockImplementation(async (mail: { messageId: string }) => {
      requests.push({ body: { ...mail }, key: mail.messageId });
      if (first) { first = false; throw Object.assign(new Error("temporary"), { responseCode: 421 }); }
      return { messageId: mail.messageId, accepted: ["accepted@example.test"] };
    });
    const firstSummary = await dispatchEmails(eventId);
    expect(firstSummary.sent).toBe(2); expect(firstSummary.failed).toBe(1);
    expect(requests.every(request => String(request.body.text).includes("Você tirou:"))).toBe(true);
    const failedRequest = requests[0];
    const retry = await dispatchEmails(eventId);
    expect(retry.sent).toBe(1);
    expect(requests.at(-1)?.key).toBe(failedRequest.key);
    const db = await getDb();
    expect((await db.query("SELECT status FROM email_deliveries WHERE event_id=$1", [eventId])).rows.every(row => row.status === "sent")).toBe(true);
    const tokenCount = (await db.query("SELECT access_token_hash FROM participants WHERE event_id=$1", [eventId])).rows;
    expect(tokenCount.every(row => /^[a-f0-9]{64}$/.test(String(row.access_token_hash)))).toBe(true);
  });
  it("não entrega listas ou pares no DTO administrativo autenticado", async () => {
    const { eventId } = await family(); await confirmDraw(eventId);
    await loginAction({ email: process.env.ADMIN_EMAIL!, password: "senha-de-teste-comprida" });
    const dashboard = await getAdminDashboard(eventId);
    expect(dashboard.selectedEvent?.participants).toHaveLength(3);
    expect(dashboard.selectedEvent?.participants.every(person => Object.keys(person).sort().join(",") === "email,emailAttempts,emailError,emailStatus,emoji,id,name")).toBe(true);
    expect(JSON.stringify(dashboard)).not.toContain("receiverId");
    expect((await saveParticipantAction({ eventId, name: "Extra", email: "extra@example.test" })).ok).toBe(false);
  });
  it("processa toda a fila uma vez por execução mesmo com falhas permanentes no início", async () => {
    const { eventId } = await family(7); await confirmDraw(eventId);
    const db = await getDb();
    await db.query("UPDATE email_deliveries SET status='failed' WHERE id IN (SELECT id FROM email_deliveries WHERE event_id=$1 ORDER BY created_at,id LIMIT 5)", [eventId]);
    process.env.GMAIL_USER = "familia@gmail.com"; process.env.GMAIL_APP_PASSWORD = "abcdefghijklmnop"; process.env.EMAIL_FROM = "familia@example.test"; process.env.APP_URL = "http://localhost:3000";
    const requestKeys: string[] = [];
    smtpSend.mockImplementation(async (mail: { messageId: string }) => {
      requestKeys.push(mail.messageId);
      throw Object.assign(new Error("rejected"), { code: "EENVELOPE" });
    });
    const summary = await dispatchEmails(eventId);
    expect(summary).toEqual({ sent: 0, failed: 7, pending: 0 });
    expect(new Set(requestKeys).size).toBe(7);
    expect((await db.query("SELECT attempts FROM email_deliveries WHERE event_id=$1", [eventId])).rows.every(row => row.attempts === 1)).toBe(true);
  });
});

describe("fluxo completo pelas ações do aplicativo", () => {
  it("convida, salva listas, sorteia, retoma falha, revoga link e inicia novo ano sem mudar o sorteio anterior", async () => {
    process.env.GMAIL_USER = "familia@gmail.com"; process.env.GMAIL_APP_PASSWORD = "abcdefghijklmnop";
    process.env.EMAIL_FROM = "Família <familia@example.test>";
    process.env.APP_URL = "https://familia.example.test";

    type Mail = { to: string[]; subject: string; text: string; html: string };
    const requests: { mail: Mail; idempotencyKey: string }[] = [];
    let failOneResult = true;
    let failedResultKey = "";
    const mailMock = vi.fn(async (mail: Mail & { messageId: string }) => {
      // Every provider request is intercepted, including retries. No real
      // credentials, external e-mails, or the application's local DB are used.
      const idempotencyKey = mail.messageId;
      requests.push({ mail, idempotencyKey });
      if (mail.text.includes("Você tirou:") && mail.to[0] === "familiar0@example.test" && failOneResult) {
        failOneResult = false;
        failedResultKey = idempotencyKey;
        throw Object.assign(new Error("temporary test failure"), { responseCode: 421 });
      }
      return { messageId: mail.messageId, accepted: ["accepted@example.test"] };
    });
    smtpSend.mockImplementation(mailMock);

    function linkToken(mail: Mail): string {
      const match = mail.text.match(/https:\/\/familia\.example\.test\/participante\/([^\s]+)/);
      expect(match, "O e-mail precisa conter o link individual acessível à família.").not.toBe(null);
      return match![1];
    }

    expect((await loginAction({ email: process.env.ADMIN_EMAIL!, password: "senha-de-teste-comprida" })).ok).toBe(true);
    const created = await saveEventAction({ name: "Encontro da família", eventDate: "2026-12-25", giftLimit: 120 });
    expect(created.ok).toBe(true);
    const eventId = created.eventId!;
    for (let index = 0; index < 3; index++) {
      expect((await saveParticipantAction({ eventId, name: `Familiar ${index}`, email: `familiar${index}@example.test` })).ok).toBe(true);
    }
    const participants = (await getAdminDashboard(eventId)).selectedEvent!.participants;
    const personZero = participants.find(person => person.name === "Familiar 0")!;
    expect(participants).toHaveLength(3);
    expect((await saveExclusionAction({ eventId, giverId: participants[0].id, receiverId: participants[1].id })).ok).toBe(true);

    expect((await sendInvitesAction({ eventId })).ok).toBe(true);
    expect(requests).toHaveLength(3);
    const invitations = new Map(requests.map(request => [request.mail.to[0], request.mail]));
    const tokens = new Map<string, string>();
    for (let index = 0; index < 3; index++) {
      const invitation = invitations.get(`familiar${index}@example.test`)!;
      expect(invitation.text).not.toContain("Você tirou:");
      const token = linkToken(invitation);
      tokens.set(`Familiar ${index}`, token);
      expect((await getParticipantPage(token))?.recipient).toBe(null);
      expect((await saveWishlistAction({ token, wishlistText: `Sugestões do Familiar ${index}` })).ok).toBe(true);
    }
    expect((await getAdminDashboard(eventId)).selectedEvent!.participants.every(person => person.emailStatus === "sent")).toBe(true);

    const draw = await drawAction({ eventId });
    expect(draw.ok).toBe(true);
    const dashboardAfterDraw = await getAdminDashboard(eventId);
    expect(dashboardAfterDraw.selectedEvent!.drawVersion).toBe(1);
    expect(dashboardAfterDraw.selectedEvent!.participants.filter(person => person.emailStatus === "sent")).toHaveLength(2);
    expect(dashboardAfterDraw.selectedEvent!.participants.filter(person => person.emailStatus === "failed")).toHaveLength(1);
    const resultRequests = requests.filter(request => request.mail.text.includes("Você tirou:"));
    expect(resultRequests).toHaveLength(3);
    const db = await getDb();
    const savedPairs = (await db.query("SELECT giver_id,receiver_id FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows;
    expect(savedPairs).toHaveLength(3);
    expect(new Set(savedPairs.map(pair => pair.receiver_id)).size).toBe(3);
    expect(savedPairs.every(pair => pair.giver_id !== pair.receiver_id)).toBe(true);
    expect(savedPairs.some(pair => pair.giver_id === participants[0].id && pair.receiver_id === participants[1].id)).toBe(false);

    for (let index = 0; index < 3; index++) {
      const result = resultRequests.find(request => request.mail.to[0] === `familiar${index}@example.test`)!;
      const page = await getParticipantPage(linkToken(result.mail));
      expect(page?.self.name).toBe(`Familiar ${index}`);
      expect(page?.recipient?.name).not.toBe(page?.self.name);
      expect(page?.recipient?.wishlistText).toBe(`Sugestões do ${page?.recipient?.name}`);
      expect(result.mail.text).toContain(`Você tirou: ${page!.recipient!.name}.`);
      expect(Object.keys(page!.recipient!).sort()).toEqual(["emoji", "name", "wishlistText"]);
      expect(JSON.stringify(page)).not.toContain("@example.test");
    }

    expect((await retryEmailsAction({ eventId })).ok).toBe(true);
    expect(requests).toHaveLength(7);
    expect(requests.at(-1)!.idempotencyKey).toBe(failedResultKey);
    expect((await getAdminDashboard(eventId)).selectedEvent!.participants.every(person => person.emailStatus === "sent")).toBe(true);
    expect((await db.query("SELECT giver_id,receiver_id FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows).toEqual(savedPairs);
    // Repeating the action after success must neither resend nor redraw.
    expect((await retryEmailsAction({ eventId })).ok).toBe(true);
    expect(requests).toHaveLength(7);
    expect((await getAdminDashboard(eventId)).selectedEvent!.drawVersion).toBe(1);

    const oldToken = tokens.get("Familiar 0")!;
    expect((await saveWishlistAction({ token: oldToken, wishlistText: "Minha lista atualizada depois do sorteio" })).ok).toBe(true);
    const giverPair = savedPairs.find(pair => pair.receiver_id === personZero.id)!;
    const giverName = participants.find(person => person.id === giverPair.giver_id)!.name;
    expect((await getParticipantPage(tokens.get(giverName)!))?.recipient?.wishlistText).toBe("Minha lista atualizada depois do sorteio");
    expect((await regenerateParticipantLinkAction({ eventId, participantId: personZero.id })).ok).toBe(true);
    const newToken = linkToken(requests.at(-1)!.mail);
    expect(newToken).not.toBe(oldToken);
    expect(await getParticipantPage(oldToken)).toBe(null);
    expect((await saveWishlistAction({ token: oldToken, wishlistText: "Tentativa com link antigo" })).ok).toBe(false);
    expect((await getParticipantPage(newToken))?.self.wishlistText).toBe("Minha lista atualizada depois do sorteio");
    expect((await db.query("SELECT giver_id,receiver_id FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows).toEqual(savedPairs);

    const copied = await saveEventAction({ name: "Encontro do próximo ano", eventDate: "2027-12-25", copyFromEventId: eventId });
    expect(copied.ok).toBe(true);
    expect(copied.eventId).not.toBe(eventId);
    const next = (await getAdminDashboard(copied.eventId)).selectedEvent!;
    expect(next.status).toBe("draft");
    expect(next.drawVersion).toBe(0);
    expect(next.exclusions).toEqual([]);
    expect(next.participants.map(person => [person.name, person.email]).sort()).toEqual(participants.map(person => [person.name, person.email]).sort());
    expect(next.participants.every(person => !participants.some(previous => previous.id === person.id) && person.emailStatus === null)).toBe(true);
    const copiedPeople = (await db.query<{ id: string; token_nonce: string; wishlist_text: string }>("SELECT id,token_nonce,wishlist_text FROM participants WHERE event_id=$1", [copied.eventId])).rows;
    expect(copiedPeople.every(person => person.wishlist_text === "")).toBe(true);
    expect((await db.query("SELECT id FROM email_deliveries WHERE event_id=$1", [copied.eventId])).rows).toHaveLength(0);
    expect((await db.query("SELECT giver_id,receiver_id FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows).toEqual(savedPairs);

    const { logoutAction } = await import("../src/server/actions");
    expect((await logoutAction()).ok).toBe(true);
    expect(await getAdminSession()).toBe(null);
    expect((await retryEmailsAction({ eventId })).ok).toBe(false);
    expect(mailMock).toHaveBeenCalledTimes(8);
  });
});

describe("recuperação após confirmação do sorteio", () => {
  it("mantém confirmação e resultados quando o processamento de e-mail lança erro depois do commit", async () => {
    const { eventId } = await family();
    expect((await loginAction({ email: process.env.ADMIN_EMAIL!, password: "senha-de-teste-comprida" })).ok).toBe(true);
    const emailModule = await import("../src/lib/email");
    const interruption = vi.spyOn(emailModule, "dispatchEmails").mockRejectedValueOnce(new Error("simulated interruption after commit"));
    try {
      const result = await drawAction({ eventId });
      expect(result.ok).toBe(true);
      expect(result.message).toMatch(/sorteio permanece salvo/);
      expect(result.message).toMatch(/retomar sem refazer/);
    } finally { interruption.mockRestore(); }
    const db = await getDb();
    const beforeRetry = (await db.query("SELECT giver_id,receiver_id FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows;
    expect(beforeRetry).toHaveLength(3);
    expect((await db.query("SELECT status,attempts FROM email_deliveries WHERE event_id=$1", [eventId])).rows.every(row => row.status === "pending" && row.attempts === 0)).toBe(true);
    expect((await retryEmailsAction({ eventId })).ok).toBe(true);
    expect((await db.query("SELECT giver_id,receiver_id FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows).toEqual(beforeRetry);
    expect((await getAdminDashboard(eventId)).selectedEvent!.drawVersion).toBe(1);
  });
});

describe("emoji individual", () => {
  it("salva, valida, copia e revela o emoji de quem foi sorteado; edição posterior preserva pares e envios", async () => {
    const { eventId, people } = await family();
    await loginAction({email: process.env.ADMIN_EMAIL!, password: "senha-de-teste-comprida"});
    const id = people[0].id;
    expect((await saveParticipantAction({eventId,id,name:"Armando",email:"pessoa0@example.test",emoji:"💀"})).ok).toBe(true);
    expect((await saveParticipantEmojiAction({eventId,participantId:id,emoji:"texto"})).ok).toBe(false);
    expect((await saveParticipantEmojiAction({eventId,participantId:id,emoji:"💀🔥"})).ok).toBe(false);
    const db = await getDb();
    const nextId = await saveEvent({name:"Novo ano",eventDate:"2027-12-25",copyFromEventId:eventId});
    expect((await db.query("SELECT emoji FROM participants WHERE event_id=$1 AND name='Armando'",[nextId])).rows[0].emoji).toBe("💀");
    await confirmDraw(eventId);
    const before = (await db.query("SELECT * FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows;
    const deliveries = (await db.query("SELECT * FROM email_deliveries WHERE event_id=$1 ORDER BY id", [eventId])).rows;
    for (const person of people) {
      const page = await getParticipantPage(participantToken(person.id,person.token_nonce));
      if (page!.recipient!.name === "Armando") expect(page!.recipient!.emoji).toBe("💀");
    }
    expect((await saveParticipantEmojiAction({eventId,participantId:id,emoji:"🐱"})).ok).toBe(true);
    expect((await getAdminDashboard(eventId)).selectedEvent!.participants.find(p=>p.id===id)!.emoji).toBe("🐱");
    expect((await db.query("SELECT * FROM draws WHERE event_id=$1 ORDER BY giver_id", [eventId])).rows).toEqual(before);
    expect((await db.query("SELECT * FROM email_deliveries WHERE event_id=$1 ORDER BY id", [eventId])).rows).toEqual(deliveries);
    expect((await saveParticipantEmojiAction({eventId:nextId,participantId:id,emoji:"🔥"})).ok).toBe(false);
    expect((await saveParticipantEmojiAction({eventId,participantId:id,emoji:""})).ok).toBe(true);
  });
});
