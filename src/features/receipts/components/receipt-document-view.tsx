"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/features/pdf/pdf-viewer";
import { canShareFile, downloadFile, shareFile } from "@/features/sharing/share-pdf";
import { retryReceiptPdf } from "../actions";

const shareIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

/** PDF salvo do recibo com Compartilhar (nativo), Baixar e Abrir. */
export function ReceiptDocumentView({
  receiptId,
  receiptNumber,
  hasPdf,
  fileName,
  highlightShare,
  readOnly = false,
}: {
  receiptId: string;
  receiptNumber: string;
  hasPdf: boolean;
  fileName: string | null;
  highlightShare: boolean;
  /** Modo suporte: só visualizar/baixar (cada acesso ao PDF é auditado). */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retrying, startRetry] = useTransition();
  const pdfUrl = `/api/recibos/${receiptId}/pdf`;

  // Pré-carrega o PDF: serve à visualização e deixa o arquivo pronto para o
  // compartilhamento acontecer no mesmo instante do toque.
  useEffect(() => {
    if (!hasPdf) return;
    const controller = new AbortController();
    fetch(pdfUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.arrayBuffer();
      })
      .then((buffer) => {
        setData(buffer);
        setFile(new File([buffer], fileName ?? `${receiptNumber}.pdf`, { type: "application/pdf" }));
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [hasPdf, pdfUrl, fileName, receiptNumber]);

  const shareSupported = !readOnly && canShareFile(file);

  async function onShare() {
    if (!file) return;
    setNotice(null);
    const outcome = await shareFile(file, `Recibo ${receiptNumber}`);
    if (outcome === "unsupported" || outcome === "failed") {
      downloadFile(file);
      setNotice("Não foi possível abrir o compartilhamento neste aparelho. O PDF foi baixado — envie pelo app que preferir.");
    }
  }

  if (!hasPdf && readOnly) {
    return <Alert tone="info">O PDF deste recibo ainda não foi gerado. Só o próprio usuário pode gerá-lo.</Alert>;
  }

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

  const secondary =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50";

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex flex-col gap-2 ${highlightShare ? "rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-200" : ""}`}>
        {shareSupported ? (
          <Button size="lg" onClick={onShare} className="w-full">
            {shareIcon} Compartilhar PDF
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`${pdfUrl}?download=1`}
            download={fileName ?? undefined}
            className={
              shareSupported
                ? secondary
                : "inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            }
          >
            Baixar PDF
          </a>
          <a href={pdfUrl} target="_blank" rel="noopener" className={secondary}>
            Abrir PDF
          </a>
        </div>
        {highlightShare && shareSupported && (
          <p className="text-center text-xs text-slate-600">Envie pelo WhatsApp, e-mail ou outro app do seu celular.</p>
        )}
        {!shareSupported && file && !readOnly && (
          <p className="text-center text-xs text-slate-500">
            Este navegador não compartilha arquivos direto. Baixe o PDF e envie pelo app que preferir.
          </p>
        )}
      </div>

      {notice && <Alert tone="info">{notice}</Alert>}
      {error ? <Alert tone="error">Não foi possível carregar o PDF. Use “Abrir PDF”.</Alert> : <PdfViewer data={data} label="Recibo" />}
    </div>
  );
}
