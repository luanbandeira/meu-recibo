import Link from "next/link";
import { formatDate } from "@/lib/format/date";
import { formatBRL } from "@/lib/format/money";
import type { ReceiptSummary } from "../queries";

function formatServiceDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Cartão de recibo: quem pagou, quanto, modelo e data — não só um nome de arquivo. */
export function ReceiptCard({ receipt }: { receipt: ReceiptSummary }) {
  return (
    <Link
      href={`/recibos/${receipt.id}`}
      className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-200 transition hover:ring-brand-300"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{receipt.payer_name ?? "Sem pagador"}</p>
        <p className="truncate text-sm text-slate-600">{receipt.template_name}</p>
        <p className="text-xs text-slate-500">
          {receipt.number}
          {receipt.current_version_no > 1 && ` · versão ${receipt.current_version_no}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {receipt.amount_cents !== null && <p className="font-semibold tabular-nums text-slate-900">{formatBRL(receipt.amount_cents)}</p>}
        <p className="text-sm text-slate-600">{formatServiceDate(receipt.service_date) ?? formatDate(receipt.issued_at)}</p>
      </div>
    </Link>
  );
}
