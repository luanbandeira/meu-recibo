"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { SelectField } from "@/components/ui/select-field";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  historyHref,
  PERIOD_OPTIONS,
  SORT_OPTIONS,
  type HistoryFilters,
} from "../history";

const SEARCH_DELAY_MS = 350;

const formatIso = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Busca e filtros do histórico. O estado vive na URL: o servidor lê os
 * parâmetros e consulta; aqui só trocamos a URL (sem recarregar a página).
 */
export function ReceiptFilters({
  filters,
  templates,
}: {
  filters: HistoryFilters;
  templates: { id: string; name: string; archived: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(filters);

  // Texto da busca: local enquanto digita. Só volta a seguir a URL quando ela
  // muda por fora (voltar do navegador, link "Limpar filtros") — nunca por
  // causa da nossa própria busca, que chega enquanto a pessoa ainda digita.
  const [text, setText] = useState(filters.q);
  const [sentQuery, setSentQuery] = useState(filters.q);
  const [urlQuery, setUrlQuery] = useState(filters.q);
  if (filters.q !== urlQuery) {
    setUrlQuery(filters.q);
    if (filters.q.trim() !== sentQuery.trim()) {
      setText(filters.q);
      setSentQuery(filters.q);
    }
  }

  const panelCount = [current.periodo, current.modelo].filter(Boolean).length;
  // Fechado por padrão (no celular o painel empurra a lista para baixo); o
  // resumo abaixo da busca mostra o que está ativo.
  const [open, setOpen] = useState(false);
  const panelId = useId();

  function apply(next: Partial<HistoryFilters>) {
    // Qualquer mudança de filtro volta para a primeira página.
    const merged = { ...current, ...next, pagina: 1 };
    setSentQuery(merged.q);
    startTransition(() => {
      setCurrent(merged);
      router.replace(historyHref(merged), { scroll: false });
    });
  }

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearchChange(value: string) {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ q: value }), SEARCH_DELAY_MS);
  }

  const periodLabel =
    current.periodo === "personalizado"
      ? [current.de && `de ${formatIso(current.de)}`, current.ate && `até ${formatIso(current.ate)}`].filter(Boolean).join(" ") || null
      : PERIOD_OPTIONS.find((o) => o.value === current.periodo && o.value)?.label;
  const templateLabel = templates.find((t) => t.id === current.modelo)?.name;
  const sortLabel = current.ordem !== "recentes" ? SORT_OPTIONS.find((o) => o.value === current.ordem)?.label : null;
  const activeSummary = [periodLabel, templateLabel, sortLabel].filter(Boolean).join(" · ");

  const templateOptions = [
    { value: "", label: "Todos os modelos" },
    ...templates.map((t) => ({ value: t.id, label: t.archived ? `${t.name} (arquivado)` : t.name })),
  ];

  return (
    <search className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          clearTimeout(timer.current);
          apply({ q: text });
          (document.activeElement as HTMLElement | null)?.blur(); // fecha o teclado no celular
        }}
        className="flex items-end gap-2"
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="Buscar"
            type="search"
            name="q"
            value={text}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nome, CPF ou número"
            enterKeyHint="search"
            autoComplete="off"
            className="[&::-webkit-search-cancel-button]:cursor-pointer"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
        >
          Filtros
          {panelCount > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-600 text-xs text-white">
              {panelCount}
              <span className="sr-only"> ativos</span>
            </span>
          )}
        </button>
      </form>

      <div id={panelId} hidden={!open} className="grid gap-3 rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-200 sm:grid-cols-3">
        <SelectField
          label="Período"
          value={current.periodo}
          options={PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(e) => apply({ periodo: e.target.value as HistoryFilters["periodo"] })}
        />
        <SelectField
          label="Modelo"
          value={current.modelo}
          options={templateOptions}
          onChange={(e) => apply({ modelo: e.target.value })}
        />
        <SelectField
          label="Ordenar por"
          value={current.ordem}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(e) => apply({ ordem: e.target.value as HistoryFilters["ordem"] })}
        />
        {current.periodo === "personalizado" && (
          <div className="grid grid-cols-2 gap-3 sm:col-span-3">
            <TextField label="De" type="date" value={current.de} max={current.ate || undefined} onChange={(e) => apply({ de: e.target.value })} />
            <TextField label="Até" type="date" value={current.ate} min={current.de || undefined} onChange={(e) => apply({ ate: e.target.value })} />
          </div>
        )}
        <p className="text-xs text-slate-500 sm:col-span-3">O período considera a data do atendimento (ou da emissão, se não houver).</p>
      </div>

      <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
        <span aria-live="polite" className="inline-flex min-w-0 items-center gap-2 text-slate-600">
          {pending ? (
            <>
              <Spinner /> Buscando…
            </>
          ) : (
            !open && activeSummary && <span className="truncate">{activeSummary}</span>
          )}
        </span>
        {hasActiveFilters(current) && (
          <button
            type="button"
            onClick={() => {
              clearTimeout(timer.current);
              setText("");
              apply({ ...EMPTY_FILTERS, ordem: current.ordem });
            }}
            className="min-h-11 rounded-lg px-2 font-medium text-brand-700 hover:bg-brand-50"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </search>
  );
}
