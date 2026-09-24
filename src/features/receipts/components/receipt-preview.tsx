"use client";

import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import type { DocumentAssets } from "@/features/templates/document/blocks-view";
import { FONTS, MARGINS, type TemplateSettings } from "@/features/templates/document/constants";
import type { DocumentProfile } from "@/features/templates/document/profile-values";
import { DocumentContent } from "@/features/templates/document/renderer";
import type { FieldDefinition } from "@/features/templates/document/variables";
import { parseDraft, readDraftRaw } from "../draft";
import { createResolver, validateValues } from "../values";

const noopSubscribe = () => () => {};

export function ReceiptPreview({
  templateId,
  content,
  settings,
  fields,
  labels,
  profile,
  assets,
}: {
  templateId: string;
  content: { content?: unknown[] };
  settings: TemplateSettings;
  fields: FieldDefinition[];
  labels: Record<string, string>;
  profile: DocumentProfile;
  assets: DocumentAssets;
}) {
  // undefined = ainda no servidor; null = sem rascunho nesta aba.
  const draftRaw = useSyncExternalStore(noopSubscribe, () => readDraftRaw(templateId), () => undefined);
  const [realSize, setRealSize] = useState(false);
  const formHref = `/emitir/${templateId}`;

  const state = useMemo(() => {
    if (draftRaw === undefined) return { kind: "loading" as const };
    const draft = parseDraft(draftRaw) ?? {};
    const result = validateValues(fields, draft);
    if (!result.ok) return { kind: "invalid" as const };
    const resolver = createResolver({ fields, values: result.values, profile, receiptNumber: null });
    // Número do recibo só existe após emitir.
    const resolve = (key: string, format?: "short" | "long" | null) =>
      key === "numero_recibo" ? { text: "REC-0000-000000", missing: false } : resolver(key, format);
    const empty = fields.filter((f) => result.values[f.key] === null).map((f) => f.label);
    return { kind: "ready" as const, resolve, empty };
  }, [draftRaw, fields, profile]);

  if (state.kind === "loading") {
    return <p className="text-sm text-slate-500">Montando a prévia…</p>;
  }

  if (state.kind === "invalid") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="info">Os dados do recibo não foram encontrados ou estão incompletos. Volte ao formulário para preencher.</Alert>
        <LinkButton href={formHref}>Ir para o formulário</LinkButton>
      </div>
    );
  }

  const pageStyle = {
    "--margin": MARGINS[settings.margins].pt,
    "--fs": settings.fontSize,
    "--lh": settings.lineHeight,
    "--doc-font": FONTS[settings.fontFamily].css,
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-4">
      {state.empty.length > 0 && (
        <Alert tone="info">
          Campos em branco (aparecem em amarelo aqui e ficam vazios no PDF): {state.empty.join(", ")}.
        </Alert>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => setRealSize((v) => !v)} className="min-h-11 rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">
          {realSize ? "Ajustar à tela" : "Ver em tamanho real"}
        </button>
      </div>

      <div className={realSize ? "overflow-x-auto pb-2" : ""}>
        <div className={`doc-page mx-auto ${realSize ? "w-[794px]" : "w-full max-w-[820px]"}`}>
          <article aria-label="Prévia do recibo" className="doc-sheet bg-white shadow-sm ring-1 ring-slate-200" style={pageStyle}>
            <DocumentContent
              doc={content}
              resolve={state.resolve}
              profile={profile}
              assets={assets}
              highlightMissing
              labelFor={(key) => labels[key] ?? key}
            />
          </article>
        </div>
      </div>

      <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-2xl bg-slate-50/95 py-2 backdrop-blur sm:static sm:flex-row sm:bg-transparent sm:py-0">
        <LinkButton href={formHref} variant="secondary" className="min-h-12 sm:flex-1">
          ← Voltar e corrigir
        </LinkButton>
        <Button size="lg" disabled className="sm:flex-1" title="Disponível na próxima fase">
          Gerar PDF (próxima fase)
        </Button>
      </div>
    </div>
  );
}
