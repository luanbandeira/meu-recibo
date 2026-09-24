import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { requireOnboardedUser } from "@/features/profile/guards";
import { ReceiptCard } from "@/features/receipts/components/receipt-card";
import { countReceiptsThisMonth, listRecentReceipts } from "@/features/receipts/queries";

export const metadata: Metadata = { title: "Início" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { userId, professional, support } = await requireOnboardedUser({ allowSupport: true });
  const query = await searchParams;
  const welcome = query["bem-vindo"] === "1";
  const blockedInSupport = support && query.suporte === "somente-leitura";
  const firstName = professional.full_name.split(" ")[0];
  const [monthCount, recent] = await Promise.all([countReceiptsThisMonth(userId), listRecentReceipts(userId, 3)]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        {support ? `Ambiente de ${professional.full_name}` : `Olá, ${firstName}`}
      </h1>
      {blockedInSupport && (
        <Alert tone="info">Essa tela ou ação não está disponível no modo de suporte (somente leitura).</Alert>
      )}
      {welcome && !support && (
        <Alert tone="success">Configuração concluída! Seus dados já estão prontos para entrar nos recibos.</Alert>
      )}

      {!support && (
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
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/recibos" className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 hover:ring-brand-300">
          <span className="block text-3xl font-semibold tabular-nums text-slate-900">{monthCount}</span>
          <span className="block text-sm text-slate-600">{monthCount === 1 ? "recibo este mês" : "recibos este mês"}</span>
        </Link>
        <Link href="/modelos" className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 hover:ring-brand-300">
          <span className="block font-semibold text-slate-900">Meus modelos</span>
          <span className="block text-sm text-slate-600">Textos, campos e layout.</span>
        </Link>
      </div>

      <section aria-labelledby="ultimos" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 id="ultimos" className="text-base font-semibold text-slate-900">
            Últimos recibos
          </h2>
          {recent.length > 0 && (
            <Link href="/recibos" className="text-sm font-medium text-brand-700">
              Ver todos →
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="rounded-2xl bg-white/60 p-5 text-sm text-slate-600 ring-1 ring-slate-200">
            Você ainda não emitiu nenhum recibo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((receipt) => (
              <li key={receipt.id}>
                <ReceiptCard receipt={receipt} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
