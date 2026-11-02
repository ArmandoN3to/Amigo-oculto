import Link from "next/link";
import type { ReactNode } from "react";

export function GiftMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 14h22v5H5zM7 19v10h18V19M16 14v15M4 14h24"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 14C5 15 6 3 11 6c3 2 5 8 5 8Zm0 0C27 15 26 3 21 6c-3 2-5 8-5 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function FamilyShell({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="border-b border-border/70 bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-3 font-semibold tracking-tight text-primary"
          >
            <GiftMark />
            <span>
              Amigo oculto
              <span className="ml-1 font-normal text-muted-foreground">
                da família
              </span>
            </span>
          </Link>
          {admin ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Organização do encontro
            </span>
          ) : (
            <span className="hidden text-sm text-muted-foreground sm:inline">
            </span>
          )}
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="mt-auto px-5 py-7 text-center text-sm text-muted-foreground">
        
      </footer>
    </div>
  );
}

export function EventFacts({
  event,
}: {
  event: { eventDate: string; giftLimit: number | null };
}) {
  const [year, month, day] = event.eventDate.split("-").map(Number);
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-4">
      <div>
        <dt className="text-sm text-muted-foreground">Nosso encontro</dt>
        <dd className="mt-1 font-medium">{date}</dd>
      </div>
      {event.giftLimit !== null ? (
        <div>
          <dt className="text-sm text-muted-foreground">Valor sugerido</dt>
          <dd className="mt-1 font-medium">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(event.giftLimit)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function GiftIllustration() {
  return (
    <div
      className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-full bg-[#edf4ef] p-12"
      aria-hidden="true"
    >
      <svg viewBox="0 0 260 260" fill="none" className="w-full">
        <path
          d="m24 185 49-8m-39 25 42-17M184 47l22-18m-8 32 25-8"
          stroke="#b19455"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M66 111h130v103H66z" fill="#17634e" />
        <path d="M56 94h150v33H56z" fill="#1f755c" />
        <path d="M118 94h26v120h-26z" fill="#f1d4c8" />
        <path d="M129 95c-52-3-57-39-36-43 22-4 36 43 36 43Z" fill="#b3494f" />
        <path d="M130 95c52-3 57-39 36-43-22-4-36 43-36 43Z" fill="#c1575e" />
        <path
          d="M89 62c14 1 28 21 40 33m39-33c-14 1-27 21-38 33"
          stroke="#8c343b"
          strokeWidth="2"
        />
        <path d="m166 143 20 5-8 26-21-6 9-25Z" fill="#fffdf8" />
        <path d="m169 144-5-14" stroke="#d5b879" strokeWidth="2" />
        <path
          d="m172 154 4 3 5-2m-11 5 9 3"
          stroke="#b3494f"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="51" cy="64" r="4" fill="#b19455" />
        <circle cx="217" cy="187" r="4" fill="#b3494f" />
        <path
          d="M65 227h134"
          stroke="#c8dacd"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
