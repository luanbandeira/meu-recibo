"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

/**
 * Mostra um PDF desenhando as páginas com pdf.js (canvas). Funciona igual em
 * desktop, Android e iPhone. Nitidez: renderiza na largura real × densidade da tela.
 */
export function PdfViewer({ data, label }: { data: ArrayBuffer | null; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!data || !container) return;
    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        // Cópia: o pdf.js transfere (e esvazia) o buffer para o worker.
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
        if (cancelled) return;
        container.replaceChildren();
        const cssWidth = container.clientWidth;
        const ratio = Math.min(window.devicePixelRatio || 1, 3);

        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = "block bg-white shadow-sm ring-1 ring-slate-200";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${label} — página ${n} de ${pdf.numPages}`);
          container.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
        setPages(pdf.numPages);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, label]);

  return (
    <div>
      {failed ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">Não foi possível exibir o PDF neste aparelho. Use “Abrir PDF”.</p>
      ) : (
        !pages && (
          <div className="flex h-64 items-center justify-center gap-2 rounded-xl bg-white text-sm text-slate-500 ring-1 ring-slate-200">
            <Spinner className="size-5" /> Gerando o PDF…
          </div>
        )
      )}
      <div ref={containerRef} className="flex flex-col gap-3" />
      {pages > 1 && <p className="mt-2 text-center text-xs text-slate-500">{pages} páginas</p>}
    </div>
  );
}
