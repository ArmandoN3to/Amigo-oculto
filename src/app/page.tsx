import {
  FamilyShell,
  EventFacts,
  GiftIllustration,
} from "@/components/family-shell";
import { Badge } from "@/components/ui/badge";
import { getPublicEvents } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const events = await getPublicEvents();
  const event = [...events].sort((a, b) =>
    b.eventDate.localeCompare(a.eventDate),
  )[0];
  return (
    <FamilyShell>
      <main
        id="conteudo"
        className="mx-auto grid w-full max-w-5xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-20 md:grid-cols-[1.2fr_0.8fr]"
      >
        <div>
          <Badge variant="secondary" className="mb-6">
            Um segredo. Muitos sorrisos.
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-primary sm:text-6xl">
            {event?.name ?? "Nosso amigo oculto"}
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
            O melhor presente é reunir a família. O resto a gente deixa por
            conta do sorteio.
          </p>
          {event ? (
            <div className="mt-8">
              <EventFacts event={event} />
            </div>
          ) : null}
          <div className="mt-10 max-w-lg rounded-2xl border border-border bg-white p-6">
            <h2 className="text-lg font-semibold">
              Seu convite chega por e-mail
            </h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {event
                ? "Abra o link individual enviado pelo organizador para escrever suas sugestões de presentes e descobrir seu amigo oculto."
                : "O organizador está preparando nosso encontro. Quando tudo estiver pronto, cada pessoa receberá seu convite individual."}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Não encontrou o convite? Confira a caixa de spam ou fale com o
              organizador da família.
            </p>
          </div>
        </div>
        <GiftIllustration />
      </main>
    </FamilyShell>
  );
}
