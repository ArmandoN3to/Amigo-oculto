import type { Metadata } from "next";
import { FamilyShell, EventFacts } from "@/components/family-shell";
import { ParticipantView } from "@/components/participant-view";
import { getParticipantPage } from "@/server/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "Seu amigo oculto",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const participant = await getParticipantPage(token);
  if (!participant)
    return (
      <FamilyShell>
        <main id="conteudo" className="mx-auto w-full max-w-lg px-5 py-16">
          <h1 className="text-3xl font-semibold tracking-tight">
            Este convite não está disponível
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            O link pode estar incompleto ou ter sido substituído. Abra o convite
            mais recente recebido por e-mail ou peça um novo link ao
            organizador.
          </p>
        </main>
      </FamilyShell>
    );
  return (
    <FamilyShell>
      <main
        id="conteudo"
        className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14"
      >
        <div className="mb-8">
          <p className="mb-3 font-medium text-primary">
            {participant.event.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Olá, {participant.self.name}!
          </h1>
          <p className="mb-6 mt-3 text-muted-foreground">
            Este é o seu cantinho no amigo oculto da família.
          </p>
          <EventFacts event={participant.event} />
        </div>
        <ParticipantView token={token} participant={participant} />
      </main>
    </FamilyShell>
  );
}
