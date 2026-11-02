import { redirect } from "next/navigation";
import { FamilyShell } from "@/components/family-shell";
import { LoginForm } from "@/components/login-form";
import { getAdminSession } from "@/lib/auth";
import { getRuntimeStatus } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [session, status] = await Promise.all([
    getAdminSession(),
    getRuntimeStatus(),
  ]);
  if (session) redirect("/admin");
  return (
    <FamilyShell admin>
      <main
        id="conteudo"
        className="mx-auto w-full max-w-md px-5 py-12 sm:py-20"
      >
        <p className="mb-3 text-sm font-medium text-primary">
          Um encontro bem cuidado
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Entrar na organização
        </h1>
        <p className="mb-8 mt-3 text-muted-foreground">
          Use o e-mail e a senha do organizador para preparar o amigo oculto da
          família.
        </p>
        {status.adminConfigured ? (
          <LoginForm />
        ) : (
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">Primeiro acesso</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A configuração do organizador está incompleta ou inválida. No
              computador onde o projeto está instalado, execute{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                npm run setup
              </code>{" "}
              e siga as orientações. Depois, reinicie a aplicação.
            </p>
          </div>
        )}
      </main>
    </FamilyShell>
  );
}
