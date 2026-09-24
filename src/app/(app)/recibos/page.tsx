import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedUser } from "@/features/profile/guards";
import { ReceiptCard } from "@/features/receipts/components/receipt-card";
import { ReceiptFilters } from "@/features/receipts/components/receipt-filters";
import { hasActiveFilters, historyHref, parseHistoryParams } from "@/features/receipts/history";
import { listTemplateOptions, searchReceipts } from "@/features/receipts/queries";
import { todayIso } from "@/features/receipts/values";
import { formatBRL } from "@/lib/format/money";

export const metadata: Metadata = { title: "Meus recibos" };

export default async function ReceiptsPage({ searchParams }: PageProps<"/recibos">) {
  const { userId, professional, support } = await requireOnboardedUser({ allowSupport: true });
  const emitAction = support ? undefined : <LinkButton href="/emitir">+ Emitir</LinkButton>;
  const params = await searchParams;
  const filters = parseHistoryParams(params);
  const deletedNumber = typeof params.excluido === "string" && /^REC-\d{4}-\d{6}$/.test(params.excluido) ? params.excluido : null;
  const deletedAlert = deletedNumber && <Alert tone="success">Recibo {deletedNumber} excluído.</Alert>;
  const [result, templates] = await Promise.all([
    searchReceipts(userId, filters, todayIso(professional.timezone)),
    listTemplateOptions(userId),
  ]);
  const filtered = hasActiveFilters(filters);
  const page = Math.min(filters.pagina, result.pageCount);

  if (result.total === 0 && !filtered) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader title="Meus recibos" actions={emitAction} />
        {deletedAlert}
        <EmptyState
          title={support ? "Nenhum recibo emitido." : "Você ainda não emitiu nenhum recibo."}
          action={support ? undefined : <LinkButton href="/emitir">Emitir primeiro recibo</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title="Meus recibos" actions={emitAction} />
      {deletedAlert}
      <ReceiptFilters filters={filters} templates={templates} />

      {result.total > 0 && (
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">
            {result.total} {result.total === 1 ? "recibo" : "recibos"}
          </span>
          {filtered && (result.total === 1 ? " encontrado" : " encontrados")}
          {result.totalAmountCents > 0 && (
            <>
              {" · "}Total <span className="font-medium tabular-nums text-slate-900">{formatBRL(result.totalAmountCents)}</span>
            </>
          )}
        </p>
      )}

      {result.items.length === 0 ? (
        <EmptyState
          title={result.total === 0 ? "Nenhum recibo encontrado." : "Esta página está vazia."}
          description={result.total === 0 ? "Confira a busca ou mude os filtros." : undefined}
          action={
            <LinkButton href={result.total === 0 ? "/recibos" : historyHref({ ...filters, pagina: 1 })} variant="secondary">
              {result.total === 0 ? "Limpar filtros" : "Ir para a primeira página"}
            </LinkButton>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {result.items.map((receipt) => (
            <li key={receipt.id}>
              <ReceiptCard receipt={receipt} />
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && result.items.length > 0 && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-2 text-sm">
          {page > 1 ? (
            <Link href={historyHref({ ...filters, pagina: page - 1 })} className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-brand-700 hover:bg-brand-50">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-600">
            Página {page} de {result.pageCount}
          </span>
          {page < result.pageCount ? (
            <Link href={historyHref({ ...filters, pagina: page + 1 })} className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-brand-700 hover:bg-brand-50">
              Próximos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
