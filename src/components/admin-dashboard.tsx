"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ActionResult,
  AdminDashboard,
  AdminEvent,
  AdminParticipant,
  PublicEvent,
} from "@/lib/types";
import {
  deleteParticipantAction,
  drawAction,
  logoutAction,
  regenerateParticipantLinkAction,
  retryEmailsAction,
  saveEventAction,
  saveExclusionAction,
  saveParticipantAction,
  saveParticipantEmojiAction,
  sendInvitesAction,
} from "@/server/actions";
import { EmojiField } from "@/components/emoji-field";
import { DEFAULT_PARTICIPANT_EMOJI } from "@/lib/emoji";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ActionFeedback, useOperation } from "@/components/action-feedback";

const selectClass =
  "flex h-10 w-full min-w-0 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function AdminDashboardView({
  dashboard,
}: {
  dashboard: AdminDashboard;
}) {
  const router = useRouter();
  const { pending, feedback, run } = useOperation();
  const event = dashboard.selectedEvent;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">
            Tudo pronto para reunir a família
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Organizar amigo oculto
          </h1>
          <p className="mt-2 text-muted-foreground">
            Cada encontro guarda seu próprio sorteio e suas lembranças.
          </p>
        </div>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run(logoutAction, () => router.replace("/admin/login"))
          }
        >
          Sair
        </Button>
      </div>
      <ActionFeedback feedback={feedback} />
      {!dashboard.emailConfigured ? (
        <Alert>
          <AlertTitle>Os e-mails ainda não estão configurados</AlertTitle>
          <AlertDescription>
            <p>
              Você já pode cadastrar o evento e os familiares. Resolva as
              pendências abaixo antes de enviar os convites. Nenhuma mensagem
              será enviada enquanto essa configuração estiver pendente.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {dashboard.emailConfigurationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {dashboard.emailWarnings.length ? (
        <Alert>
          <AlertTitle>Confira os links antes de convidar a família</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {dashboard.emailWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-48 flex-1 space-y-2 sm:max-w-sm">
          <Label htmlFor="event-selector">Encontro da família</Label>
          <select
            id="event-selector"
            className={selectClass}
            value={event?.id ?? ""}
            onChange={(e) =>
              router.push(`/admin?evento=${encodeURIComponent(e.target.value)}`)
            }
            disabled={!dashboard.events.length}
          >
            {!event ? <option value="">Nenhum evento cadastrado</option> : null}
            {dashboard.events.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <EventDialog events={dashboard.events} />
      </div>
      {event ? (
        <EventWorkspace
          key={event.id}
          event={event}
          events={dashboard.events}
          emailConfigured={dashboard.emailConfigured}
        />
      ) : (
        <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">
            Vamos preparar o primeiro encontro?
          </h2>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
            Crie o evento, adicione os familiares e, quando todos estiverem na
            lista, faça o sorteio.
          </p>
          <div className="mt-6">
            <EventDialog events={dashboard.events} />
          </div>
        </div>
      )}
    </div>
  );
}

function EventDialog({
  events,
  event,
}: {
  events: PublicEvent[];
  event?: AdminEvent;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={event ? "outline" : "default"} className={event ? "text-foreground" : undefined}>
          {event ? "Editar evento" : "Novo evento"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event ? "Editar encontro" : "Um novo encontro em família"}
          </DialogTitle>
          <DialogDescription>
            {event
              ? "Atualize as informações do encontro."
              : "Os sorteios de outros anos ficam preservados. Se quiser, copie apenas os nomes e e-mails de um evento anterior."}
          </DialogDescription>
        </DialogHeader>
        <EventForm
          events={events}
          event={event}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  event,
  events,
  onSaved,
}: {
  event?: AdminEvent;
  events: PublicEvent[];
  onSaved: () => void;
}) {
  const { pending, feedback, run } = useOperation();
  const router = useRouter();
  return (
    <form
      className="space-y-5"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const amount = String(data.get("giftLimit") ?? "");
        run(async () => {
          const result = await saveEventAction({
            id: event?.id,
            name: String(data.get("name")),
            eventDate: String(data.get("eventDate")),
            giftLimit: amount ? Number(amount) : null,
            copyFromEventId: String(data.get("copyFrom") ?? "") || undefined,
          });
          if (result.ok) {
            onSaved();
            if (result.eventId)
              router.push(
                `/admin?evento=${encodeURIComponent(result.eventId)}`,
              );
          }
          return result;
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="event-name">Nome do evento</Label>
        <Input
          id="event-name"
          name="name"
          required
          maxLength={120}
          defaultValue={event?.name}
          placeholder="Natal da família 2026"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="event-date">Data do encontro</Label>
          <Input
            id="event-date"
            name="eventDate"
            type="date"
            required
            defaultValue={event?.eventDate}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-gift">Valor sugerido (R$)</Label>
          <Input
            id="event-gift"
            name="giftLimit"
            type="number"
            min="0"
            step="0.01"
            defaultValue={event?.giftLimit ?? ""}
            placeholder="Opcional"
          />
        </div>
      </div>
      {!event && events.length ? (
        <div className="space-y-2">
          <Label htmlFor="copy-from">Copiar familiares de outro evento</Label>
          <select
            className={selectClass}
            id="copy-from"
            name="copyFrom"
            defaultValue=""
          >
            <option value="">Começar com uma lista vazia</option>
            {events.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">
            As sugestões, restrições e resultados anteriores não são copiados.
          </p>
        </div>
      ) : null}
      <ActionFeedback feedback={feedback} />
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Salvando…" : event ? "Salvar alterações" : "Criar evento"}
      </Button>
    </form>
  );
}

function EventWorkspace({
  event,
  events,
  emailConfigured,
}: {
  event: AdminEvent;
  events: PublicEvent[];
  emailConfigured: boolean;
}) {
  const drawn = event.status === "drawn";
  return (
    <div className="space-y-7">
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-primary px-6 py-6 text-primary-foreground">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold">{event.name}</h2>
            <Badge className="border-white/20 bg-white/15 text-white">
              {drawn ? "Sorteio realizado" : "Preparando o encontro"}
            </Badge>
          </div>
          <p className="text-sm opacity-85">
            {event.participants.length}{" "}
            {event.participants.length === 1
              ? "familiar cadastrado"
              : "familiares cadastrados"}
            {drawn
              ? " · Resultado salvo com segurança"
              : " · A lista pode ser alterada até o sorteio"}
          </p>
        </div>
        <EventDialog events={events} event={event} />
      </section>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="space-y-7">
          <ParticipantsPanel event={event} emailConfigured={emailConfigured} />
          <ExclusionsPanel event={event} />
        </div>
        <div className="space-y-7">
          <DrawPanel event={event} />
          <EmailPanel event={event} configured={emailConfigured} />
        </div>
      </div>
    </div>
  );
}

function ParticipantsPanel({
  event,
  emailConfigured,
}: {
  event: AdminEvent;
  emailConfigured: boolean;
}) {
  const drawn = event.status === "drawn";
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Quem vai participar?</CardTitle>
          <CardDescription className="mt-2">
            Nome, e-mail e emoji de cada familiar.
          </CardDescription>
        </div>
        {!drawn ? <ParticipantDialog eventId={event.id} /> : null}
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {drawn
            ? "A lista está fechada para preservar o resultado do sorteio."
            : "Confira os endereços antes de enviar os convites."}
        </p>
        {event.participants.length ? (
          <ul className="divide-y">
            {event.participants.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="break-words font-medium">{person.name} <span aria-hidden>{person.emoji || DEFAULT_PARTICIPANT_EMOJI}</span></p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {person.email}
                  </p>
                  <div className="mt-2">
                    <EmailBadge status={person.emailStatus} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {person.emailAttempts}{" "}
                    {person.emailAttempts === 1
                      ? "tentativa de envio"
                      : "tentativas de envio"}
                  </p>
                  {person.emailError ? (
                    <p className="mt-2 break-words text-sm text-destructive">
                      Última falha: {person.emailError}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  <ParticipantEmojiDialog eventId={event.id} participant={person} />
                  {!drawn ? (
                    <>
                      <ParticipantDialog
                        eventId={event.id}
                        participant={person}
                      />
                      <ConfirmAction
                        label="Excluir"
                        title={`Excluir ${person.name}?`}
                        description="Essa pessoa será removida da lista deste evento. Você poderá cadastrá-la novamente antes do sorteio."
                        confirmLabel="Excluir familiar"
                        destructive
                        action={() =>
                          deleteParticipantAction({
                            eventId: event.id,
                            participantId: person.id,
                          })
                        }
                      />
                    </>
                  ) : null}
                  <ConfirmAction
                    label="Renovar link"
                    title={`Renovar o convite de ${person.name}?`}
                    description="O link anterior deixará de funcionar. Um novo convite será preparado para o e-mail cadastrado, mantendo o resultado do sorteio."
                    confirmLabel="Renovar link"
                    disabled={!emailConfigured}
                    action={() =>
                      regenerateParticipantLinkAction({
                        eventId: event.id,
                        participantId: person.id,
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            A lista ainda está vazia. Adicione o primeiro familiar para começar.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParticipantDialog({
  eventId,
  participant,
}: {
  eventId: string;
  participant?: AdminParticipant;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={participant ? "ghost" : "default"}>
          {participant ? "Editar" : "Adicionar familiar"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {participant ? "Editar familiar" : "Adicionar familiar"}
          </DialogTitle>
          <DialogDescription>
            O convite e o resultado serão enviados para este e-mail.
          </DialogDescription>
        </DialogHeader>
        <ParticipantForm
          eventId={eventId}
          participant={participant}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ParticipantForm({
  eventId,
  participant,
  onSaved,
}: {
  eventId: string;
  participant?: AdminParticipant;
  onSaved: () => void;
}) {
  const { pending, feedback, run } = useOperation();
  return (
    <form
      className="space-y-5"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        run(
          () =>
            saveParticipantAction({
              eventId,
              id: participant?.id,
              name: String(data.get("name")),
              email: String(data.get("email")),
              emoji: String(data.get("emoji") || ""),
            }),
          onSaved,
        );
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="person-name">Nome</Label>
        <Input
          id="person-name"
          name="name"
          required
          maxLength={100}
          defaultValue={participant?.name}
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="person-email">E-mail</Label>
        <Input
          id="person-email"
          name="email"
          type="email"
          required
          maxLength={254}
          defaultValue={participant?.email}
          autoComplete="email"
        />
      </div>
      <EmojiField initialValue={participant?.emoji} disabled={pending} />
      <ActionFeedback feedback={feedback} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? "Salvando…"
          : participant
            ? "Salvar alterações"
            : "Adicionar familiar"}
      </Button>
    </form>
  );
}

function ExclusionsPanel({ event }: { event: AdminEvent }) {
  const { pending, feedback, run } = useOperation();
  const drawn = event.status === "drawn";
  const names = new Map(event.participants.map((p) => [p.id, p.name]));
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Combinações a evitar</CardTitle>
        <CardDescription>
          Opcional. Por padrão, qualquer pessoa pode tirar outra, exceto a si
          mesma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!drawn && event.participants.length >= 2 ? (
          <form
            className="space-y-4"
            aria-busy={pending}
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              run(() =>
                saveExclusionAction({
                  eventId: event.id,
                  giverId: String(data.get("giver")),
                  receiverId: String(data.get("receiver")),
                }),
              );
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exclusion-giver">Esta pessoa</Label>
                <select
                  id="exclusion-giver"
                  name="giver"
                  className={selectClass}
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Escolha um familiar
                  </option>
                  {event.participants.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exclusion-receiver">Não pode tirar</Label>
                <select
                  id="exclusion-receiver"
                  name="receiver"
                  className={selectClass}
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Escolha um familiar
                  </option>
                  {event.participants.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              A regra vale apenas nesse sentido. Para impedir as duas pessoas de
              se tirarem, adicione também a combinação inversa.
            </p>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Salvando…" : "Adicionar restrição"}
            </Button>
          </form>
        ) : null}
        <ActionFeedback feedback={feedback} />
        {event.exclusions.length ? (
          <ul className="divide-y">
            {event.exclusions.map((rule) => (
              <li
                className="flex items-center justify-between gap-3 py-3"
                key={`${rule.giverId}-${rule.receiverId}`}
              >
                <p className="text-sm">
                  <strong className="font-medium">
                    {names.get(rule.giverId)}
                  </strong>{" "}
                  não tira{" "}
                  <strong className="font-medium">
                    {names.get(rule.receiverId)}
                  </strong>
                </p>
                {!drawn ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        saveExclusionAction({
                          eventId: event.id,
                          ...rule,
                          remove: true,
                        }),
                      )
                    }
                    aria-label={`Remover restrição: ${names.get(rule.giverId)} não tira ${names.get(rule.receiverId)}`}
                  >
                    Remover
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma combinação bloqueada.
            {event.participants.length < 2
              ? " Cadastre pelo menos dois familiares para definir restrições."
              : ""}
          </p>
        )}
        {drawn ? (
          <p className="text-sm text-muted-foreground">
            As restrições deste sorteio estão fechadas.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DrawPanel({ event }: { event: AdminEvent }) {
  const drawn = event.status === "drawn";
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>
          {drawn ? "O segredo está guardado" : "Hora do sorteio"}
        </CardTitle>
        <CardDescription>
          {drawn
            ? "Cada familiar tem seu amigo oculto. Nem o organizador vê os pares por aqui."
            : "Confira a lista e as restrições antes de continuar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {drawn
            ? "O resultado permanece salvo mesmo que algum e-mail não seja enviado. Reenviar uma mensagem não altera o sorteio."
            : "Ninguém tira a si mesmo e cada pessoa é sorteada uma única vez. Após a confirmação, a lista de participantes fica fechada."}
        </p>
        {!drawn && event.participants.length < 2 ? (
          <p className="text-sm font-medium text-primary">
            Adicione pelo menos dois familiares para sortear.
          </p>
        ) : null}
        <ConfirmAction
          label={drawn ? "Refazer sorteio" : "Fazer sorteio"}
          title={
            drawn
              ? "Refazer o sorteio deste evento?"
              : "Está tudo certo para sortear?"
          }
          description={
            drawn
              ? "Todos os resultados anteriores serão substituídos. Os familiares receberão novos resultados por e-mail quando o envio estiver configurado. Faça isso somente se a família estiver de acordo."
              : `O sorteio será feito para ${event.participants.length} familiares, respeitando as restrições cadastradas. A lista ficará fechada e os resultados serão enviados por e-mail quando o serviço estiver configurado.`
          }
          confirmLabel={drawn ? "Sim, refazer sorteio" : "Confirmar sorteio"}
          destructive={drawn}
          disabled={event.participants.length < 2}
          prominent={!drawn}
          action={() =>
            drawAction({
              eventId: event.id,
              redraw: drawn,
              expectedDrawVersion: drawn ? event.drawVersion : undefined,
            })
          }
        />
      </CardContent>
    </Card>
  );
}

function EmailPanel({
  event,
  configured,
}: {
  event: AdminEvent;
  configured: boolean;
}) {
  const { pending, feedback, run } = useOperation();
  const sent = event.participants.filter(
    (p) => p.emailStatus === "sent",
  ).length;
  const failed = event.participants.filter(
    (p) => p.emailStatus === "failed",
  ).length;
  const remaining = event.participants.length - sent;
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Convites e resultados</CardTitle>
        <CardDescription>
          {event.status === "drawn"
            ? "Acompanhe os e-mails com o resultado."
            : "Convide a família para preencher as sugestões."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Aceitos</dt>
            <dd className="mt-1 text-xl font-semibold">{sent}</dd>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Pendentes</dt>
            <dd className="mt-1 text-xl font-semibold">{remaining - failed}</dd>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Com falha</dt>
            <dd className="mt-1 text-xl font-semibold">{failed}</dd>
          </div>
        </dl>
        <p className="text-sm leading-relaxed text-muted-foreground">
          “Aceitos” são os e-mails aceitos pelo serviço de envio. Esse status não
          confirma a chegada à caixa de entrada. Confira também a pasta de spam.
        </p>
        {event.status !== "drawn" ? (
          <Button
            className="w-full"
            variant="outline"
            disabled={pending || !configured || !event.participants.length}
            onClick={() => run(() => sendInvitesAction({ eventId: event.id }))}
          >
            {pending ? "Enviando…" : "Enviar convites"}
          </Button>
        ) : null}
        <Button
          className="w-full"
          variant="outline"
          disabled={pending || !configured || !remaining}
          onClick={() => run(() => retryEmailsAction({ eventId: event.id }))}
        >
          {pending ? "Enviando…" : "Enviar pendentes e tentar falhas"}
        </Button>
        <ActionFeedback feedback={feedback} />
        {!configured ? (
          <p className="text-sm text-muted-foreground">
            Os envios aguardam a configuração do serviço de e-mail.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cada pessoa recebe somente o próprio link para consultar o resultado
            e atualizar sua lista.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EmailBadge({ status }: { status: AdminParticipant["emailStatus"] }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "failed"
          ? "border-destructive/30 text-destructive"
          : status === "sent"
            ? "border-primary/25 text-primary"
            : "text-muted-foreground"
      }
    >
      {status === "sent"
        ? "Aceito pelo serviço de envio"
        : status === "failed"
          ? "Falha no envio"
          : "Envio pendente"}
    </Badge>
  );
}

function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  action,
  destructive = false,
  disabled = false,
  prominent = false,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<ActionResult>;
  destructive?: boolean;
  disabled?: boolean;
  prominent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { pending, feedback, run, clearFeedback } = useOperation();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          clearFeedback();
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          size={prominent ? "default" : "sm"}
          variant={prominent ? "default" : "ghost"}
          disabled={disabled}
          className={
            destructive ? "text-destructive hover:text-destructive" : ""
          }
        >
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <ActionFeedback feedback={feedback} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : ""
            }
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              run(action, () => setOpen(false));
            }}
          >
            {pending ? "Aguarde…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      {!open && feedback?.ok ? <ActionFeedback feedback={feedback} /> : null}
    </AlertDialog>
  );
}

function ParticipantEmojiDialog({ eventId, participant }: { eventId: string; participant: AdminParticipant }) {
  const [open, setOpen] = useState(false);
  const { pending, feedback, run, clearFeedback } = useOperation();
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); clearFeedback(); } }}>
    <DialogTrigger asChild><Button size="sm" variant="ghost" aria-label={`Alterar emoji de ${participant.name}`}>Emoji</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Emoji de {participant.name}</DialogTitle>
        <DialogDescription>Personalize a revelação desta pessoa. Você pode alterar o emoji mesmo depois do sorteio.</DialogDescription>
      </DialogHeader>
      <form className="space-y-5" aria-busy={pending} onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        run(() => saveParticipantEmojiAction({eventId, participantId: participant.id, emoji: String(data.get("emoji") || "")}), () => setOpen(false));
      }}>
        <EmojiField key={participant.emoji} initialValue={participant.emoji} disabled={pending} />
        <ActionFeedback feedback={feedback} />
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Salvando…" : "Salvar emoji"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
