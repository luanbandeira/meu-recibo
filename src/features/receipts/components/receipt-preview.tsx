"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PdfViewer } from "@/features/pdf/pdf-viewer";
import type { FieldDefinition } from "@/features/templates/document/variables";
import { issueReceipt } from "../actions";
import { clearDraft, idempotencyKeyFor, parseDraft, readDraftRaw, resetIdempotencyKey } from "../draft";
import { validateValues } from "../values";

const noopSubscribe = () => () => {};

export function ReceiptPreview({ templateId, fields }: { templateId: string; fields: FieldDefinition[] }) {
  const router = useRouter();
  // undefined = ainda no servidor; null = sem rascunho nesta aba.
  const draftRaw = useSyncExternalStore(noopSubscribe, () => readDraftRaw(templateId), () => undefined);
  const formHref = `/emitir/${templateId}`;

  const draft = useMemo(() => {
    if (draftRaw === undefined) return { kind: "loading" as const };
    const values = parseDraft(draftRaw) ?? {};
    const result = validateValues(fields, values);
    if (!result.ok) return { kind: "invalid" as const };
    const empty = fields.filter((f) => result.values[f.key] === null).map((f) => f.label);
    return { kind: "ready" as const, values, empty };
  }, [draftRaw, fields]);

  const [pdf, setPdf] = useState<{ data: ArrayBuffer; url: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  // A prévia é o próprio PDF, gerado no servidor com os dados do formulário.
  useEffect(() => {
    if (draft.kind !== "ready") return;
    const controller = new AbortController();
    let url = "";
    fetch("/api/recibos/previa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, values: draft.values }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Falha ao gerar a prévia.");
        const data = await response.arrayBuffer();
        url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
        setPdf({ data, url });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setPreviewError(e.message);
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [draft, templateId]);

  async function issue() {
    if (draft.kind !== "ready") return;
    setIssuing(true);
    setIssueError(null);
    const result = await issueReceipt({
      templateId,
      values: draft.values,
      idempotencyKey: idempotencyKeyFor(templateId),
    }).catch(() => ({ ok: false as const, error: "Sem conexão. Tente novamente — o recibo não será duplicado." }));

    if (result.ok) {
      clearDraft(templateId);
      resetIdempotencyKey(templateId);
      router.push(`/recibos/${result.receiptId}?novo=1`);
      return;
    }
    setIssuing(false);
    setIssueError("errors" in result && result.errors ? "Alguns dados precisam ser corrigidos. Volte ao formulário." : (result.error ?? "Não foi possível emitir."));
  }

  if (draft.kind === "loading") return <p className="text-sm text-slate-500">Carregando…</p>;

  if (draft.kind === "invalid") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="info">Os dados do recibo não foram encontrados ou estão incompletos. Volte ao formulário para preencher.</Alert>
        <LinkButton href={formHref}>Ir para o formulário</LinkButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {draft.empty.length > 0 && (
        <Alert tone="info">Campos deixados em branco (ficam vazios no recibo): {draft.empty.join(", ")}.</Alert>
      )}
      {previewError && (
        <Alert tone="error">
          {previewError}{" "}
          <button type="button" className="font-medium underline" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </Alert>
      )}

      <PdfViewer data={pdf?.data ?? null} label="Prévia do recibo" />
      {pdf && (
        <a href={pdf.url} target="_blank" rel="noopener" className="self-center text-sm font-medium text-brand-700 underline">
          Abrir prévia em tela cheia
        </a>
      )}

      {issueError && <Alert tone="error">{issueError}</Alert>}
      <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-2xl bg-slate-50/95 py-2 backdrop-blur sm:static sm:flex-row sm:bg-transparent sm:py-0">
        <LinkButton href={formHref} variant="secondary" className="min-h-12 sm:flex-1">
          ← Voltar e corrigir
        </LinkButton>
        <Button size="lg" className="sm:flex-1" pending={issuing} disabled={!pdf} onClick={issue}>
          {issuing ? "Emitindo…" : "Gerar PDF"}
        </Button>
      </div>
      <p className="text-center text-xs text-slate-500">Ao gerar, o recibo recebe um número e fica salvo em Meus recibos.</p>
    </div>
  );
}
