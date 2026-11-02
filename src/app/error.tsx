"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="conteudo"
      className="mx-auto flex min-h-[70dvh] max-w-lg flex-col justify-center px-5 py-12"
    >
      <h1 className="text-3xl font-semibold tracking-tight">
        Não foi possível abrir esta página
      </h1>
      <p className="mb-6 mt-4 leading-relaxed text-muted-foreground">
        Tente novamente em alguns instantes. Se continuar, avise o organizador
        para verificar a aplicação.
      </p>
      <Button className="self-start" onClick={reset}>
        Tentar novamente
      </Button>
    </main>
  );
}
