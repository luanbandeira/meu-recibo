import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
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
  const isNew = (await searchParams).novo === "1";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader
        title={receipt.payer_name ?? receipt.number}
        description={`${receipt.number} · ${receipt.template_name}${receipt.current_version_no > 1 ? ` · versão ${receipt.current_version_no}` : ""}`}
        back={{ href: "/recibos", label: "Meus recibos" }}
      />

      {isNew && <Alert tone="success">Recibo {receipt.number} emitido e salvo.</Alert>}

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

      <ReceiptDocumentView receiptId={receipt.id} hasPdf={Boolean(current?.pdf_path)} fileName={current?.file_name ?? null} />
    </div>
  );
}
