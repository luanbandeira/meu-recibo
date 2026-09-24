import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { requireOnboardedUser } from "@/features/profile/guards";

export const metadata: Metadata = { title: "Início" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { professional } = await requireOnboardedUser();
  const welcome = (await searchParams)["bem-vindo"] === "1";
  const firstName = professional.full_name.split(" ")[0];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">Olá, {firstName}</h1>
      {welcome && (
        <Alert tone="success">Configuração concluída! Seus dados já estão prontos para entrar nos recibos.</Alert>
      )}

      <Link
        href="/emitir"
        className="flex items-center justify-between gap-4 rounded-2xl bg-brand-600 p-6 text-white shadow-sm transition hover:bg-brand-700 active:bg-brand-800"
      >
        <span>
          <span className="block text-xl font-semibold">+ Emitir recibo</span>
          <span className="block text-sm text-brand-100">Escolha o modelo e preencha só o que muda.</span>
        </span>
        <span aria-hidden="true" className="text-3xl">
          →
        </span>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/modelos" className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 hover:ring-brand-300">
          <span className="block font-semibold text-slate-900">Meus modelos</span>
          <span className="block text-sm text-slate-600">Criar e ajustar textos, campos e layout.</span>
        </Link>
        <div className="rounded-2xl bg-white/60 p-5 ring-1 ring-dashed ring-slate-300">
          <span className="block font-semibold text-slate-700">Meus recibos</span>
          <span className="block text-sm text-slate-500">O histórico aparece aqui a partir da próxima fase.</span>
        </div>
      </div>
    </div>
  );
}
