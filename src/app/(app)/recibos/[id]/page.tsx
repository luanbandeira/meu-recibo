import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedUser } from "@/features/profile/guards";
import { ReceiptDocumentView } from "@/features/receipts/components/receipt-document-view";
import { getReceipt } from "@/features/receipts/queries";
import { formatDateTime } from "@/lib/format/date";
import { formatBRL } from "@/lib/format/money";

export const metadata: Metadata = { title: "Recibo" };

export default async function ReceiptPage({ params, searchParams }: PageProps<"/recibos/[id]">) {
  const { userId } = await requireOnboardedUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const result = await getReceipt(userId, id);
  if (!result) notFound();
  const { receipt, versions } = result;
  const current = versions.find((v) => v.version_no === receipt.current_version_no);
  const query = await searchParams;
  const isNew = query.novo === "1";
  const isCorrected = query.corrigido === "1";
  const duplicateHref = receipt.template_id
    ? `/emitir/${receipt.template_id}?duplicar=${receipt.id}`
    : `/emitir?duplicar=${receipt.id}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader
        title={receipt.payer_name ?? receipt.number}
        description={`${receipt.number} · ${receipt.template_name}${receipt.current_version_no > 1 ? ` · versão ${receipt.current_version_no}` : ""}`}
        back={{ href: "/recibos", label: "Meus recibos" }}
        actions={
          <>
            <LinkButton href={duplicateHref} variant="secondary">
              Duplicar
            </LinkButton>
            {receipt.status === "issued" && (
              <LinkButton href={`/recibos/${receipt.id}/corrigir`} variant="secondary">
                Corrigir
              </LinkButton>
            )}
          </>
        }
      />

      {isNew && <Alert tone="success">Recibo {receipt.number} emitido e salvo. Agora é só compartilhar.</Alert>}
      {isCorrected && (
        <Alert tone="success">
          Correção salva: versão {receipt.current_version_no} de {receipt.number}. Se você já tinha enviado o recibo, envie
          esta versão de novo.
        </Alert>
      )}

      <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 text-sm shadow-xs ring-1 ring-slate-200 sm:grid-cols-3">
        {receipt.amount_cents !== null && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Valor</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{formatBRL(receipt.amount_cents)}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Emitido em</dt>
          <dd className="text-slate-900">{formatDateTime(receipt.issued_at)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Número</dt>
          <dd className="font-mono text-slate-900">{receipt.number}</dd>
        </div>
      </dl>

      <ReceiptDocumentView
        receiptId={receipt.id}
        receiptNumber={receipt.number}
        hasPdf={Boolean(current?.pdf_path)}
        fileName={current?.file_name ?? null}
        highlightShare={isNew || isCorrected}
      />

      {versions.length > 1 && (
        <section aria-labelledby="versoes" className="flex flex-col gap-2">
          <h2 id="versoes" className="text-base font-semibold text-slate-900">
            Versões
          </h2>
          <ol className="flex flex-col divide-y divide-slate-200 rounded-2xl bg-white text-sm shadow-xs ring-1 ring-slate-200">
            {versions.map((version) => {
              const isCurrent = version.version_no === receipt.current_version_no;
              return (
                <li key={version.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      Versão {version.version_no}
                      {isCurrent && <span className="ml-2 text-xs font-normal text-emerald-700">atual</span>}
                      {version.version_no === 1 && <span className="ml-2 text-xs font-normal text-slate-500">original</span>}
                    </p>
                    <p className="text-slate-600">{formatDateTime(version.created_at)}</p>
                    {version.correction_note && <p className="mt-1 break-words text-slate-700">“{version.correction_note}”</p>}
                  </div>
                  {version.pdf_path && (
                    <a
                      href={`/api/recibos/${receipt.id}/pdf?versao=${version.version_no}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 font-medium text-brand-700 hover:bg-brand-50"
                    >
                      Abrir PDF<span className="sr-only"> da versão {version.version_no}</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
