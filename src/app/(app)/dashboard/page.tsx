import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { requireUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Início" };

export default async function DashboardPage() {
  const { profile } = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">Olá, {profile.display_name}</h1>
      <Alert tone="info">
        Seu acesso está funcionando. O painel com emissão de recibos chega nas próximas fases.
      </Alert>
    </div>
  );
}
