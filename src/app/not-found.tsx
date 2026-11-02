import Link from "next/link";
import { FamilyShell } from "@/components/family-shell";

export default function NotFound() {
  return (
    <FamilyShell>
      <main id="conteudo" className="mx-auto w-full max-w-lg px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          Não encontramos esta página
        </h1>
        <p className="mb-6 mt-4 leading-relaxed text-muted-foreground">
          Confira o endereço ou volte ao início. Se estiver procurando seu
          convite, abra o link mais recente recebido por e-mail.
        </p>
        <Link
          className="font-medium text-primary underline underline-offset-4"
          href="/"
        >
          Voltar ao início
        </Link>
      </main>
    </FamilyShell>
  );
}
