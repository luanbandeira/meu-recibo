"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/features/pdf/pdf-viewer";
import { retryReceiptPdf } from "../actions";

/** PDF salvo do recibo + ações de baixar/abrir (compartilhar chega na Fase 7). */
export function ReceiptDocumentView({ receiptId, hasPdf, fileName }: { receiptId: string; hasPdf: boolean; fileName: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState(false);
  const [retrying, startRetry] = useTransition();
  const pdfUrl = `/api/recibos/${receiptId}/pdf`;

  useEffect(() => {
    if (!hasPdf) return;
    const controller = new AbortController();
    fetch(pdfUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.arrayBuffer();
      })
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [hasPdf, pdfUrl]);

  if (!hasPdf) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="info">O recibo foi emitido, mas o PDF não chegou a ser gerado (falha de conexão). Gere agora:</Alert>
        <Button
          pending={retrying}
          onClick={() =>
            startRetry(async () => {
              await retryReceiptPdf(receiptId);
              router.refresh();
            })
          }
        >
          Gerar PDF
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`${pdfUrl}?download=1`}
          download={fileName ?? undefined}
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          Baixar PDF
        </a>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
        >
          Abrir PDF
        </a>
      </div>
      {error ? <Alert tone="error">Não foi possível carregar o PDF. Use “Abrir PDF”.</Alert> : <PdfViewer data={data} label="Recibo" />}
    </div>
  );
}
