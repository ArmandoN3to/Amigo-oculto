import { FamilyShell } from "@/components/family-shell";
import { AdminDashboardView } from "@/components/admin-dashboard";
import { getAdminDashboard } from "@/server/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento } = await searchParams;
  const dashboard = await getAdminDashboard(evento);
  return (
    <FamilyShell admin>
      <main
        id="conteudo"
        className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12"
      >
        <AdminDashboardView dashboard={dashboard} />
      </main>
    </FamilyShell>
  );
}
