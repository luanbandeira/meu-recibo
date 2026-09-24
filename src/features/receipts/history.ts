// Filtros do histórico: lidos da URL (compartilhável, funciona com voltar do
// navegador) e convertidos no que a consulta precisa. Funções puras.

export const PAGE_SIZE = 20;

export const SORT_OPTIONS = [
  { value: "recentes", label: "Emitidos mais recentes" },
  { value: "antigos", label: "Emitidos mais antigos" },
  { value: "data", label: "Data do atendimento" },
  { value: "valor", label: "Maior valor" },
  { value: "pagador", label: "Nome (A–Z)" },
] as const;

export const PERIOD_OPTIONS = [
  { value: "", label: "Qualquer data" },
  { value: "mes", label: "Este mês" },
  { value: "mes-anterior", label: "Mês passado" },
  { value: "3-meses", label: "Últimos 3 meses" },
  { value: "ano", label: "Este ano" },
  { value: "ano-anterior", label: "Ano passado" },
  { value: "personalizado", label: "Escolher datas…" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];
export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

export type HistoryFilters = {
  q: string;
  periodo: PeriodValue;
  de: string;
  ate: string;
  modelo: string;
  ordem: SortValue;
  pagina: number;
};

export const EMPTY_FILTERS: HistoryFilters = { q: "", periodo: "", de: "", ate: "", modelo: "", ordem: "recentes", pagina: 1 };

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Lê os filtros da URL, descartando o que for inválido. */
export function parseHistoryParams(params: Params): HistoryFilters {
  const periodo = first(params.periodo);
  const ordem = first(params.ordem);
  const de = first(params.de);
  const ate = first(params.ate);
  const modelo = first(params.modelo);
  const pagina = Number.parseInt(first(params.pagina), 10);
  return {
    q: first(params.q).slice(0, 200),
    periodo: PERIOD_OPTIONS.some((o) => o.value === periodo) ? (periodo as PeriodValue) : "",
    de: isIsoDate(de) ? de : "",
    ate: isIsoDate(ate) ? ate : "",
    modelo: isUuid(modelo) ? modelo.toLowerCase() : "",
    ordem: SORT_OPTIONS.some((o) => o.value === ordem) ? (ordem as SortValue) : "recentes",
    pagina: Number.isFinite(pagina) && pagina > 1 ? Math.min(pagina, 10_000) : 1,
  };
}

/** Monta a URL do histórico; omite o que está no padrão. */
export function historyHref(filters: Partial<HistoryFilters>): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.periodo) params.set("periodo", filters.periodo);
  if (filters.periodo === "personalizado") {
    if (filters.de) params.set("de", filters.de);
    if (filters.ate) params.set("ate", filters.ate);
  }
  if (filters.modelo) params.set("modelo", filters.modelo);
  if (filters.ordem && filters.ordem !== "recentes") params.set("ordem", filters.ordem);
  if (filters.pagina && filters.pagina > 1) params.set("pagina", String(filters.pagina));
  const query = params.toString();
  return query ? `/recibos?${query}` : "/recibos";
}

/** Há filtro que restringe o resultado (a ordenação não conta). */
export function hasActiveFilters(filters: HistoryFilters): boolean {
  return Boolean(filters.q.trim() || filters.periodo || filters.modelo);
}

function shiftMonths(iso: string, months: number): string {
  const [y, m] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(isoFirstDay: string): string {
  const [y, m] = isoFirstDay.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Intervalo de datas (inclusivo) do período escolhido, a partir de "hoje" no fuso do profissional. */
export function periodRange(filters: Pick<HistoryFilters, "periodo" | "de" | "ate">, today: string): { from: string | null; to: string | null } {
  const monthStart = `${today.slice(0, 7)}-01`;
  const year = Number(today.slice(0, 4));
  switch (filters.periodo) {
    case "mes":
      return { from: monthStart, to: lastDayOfMonth(monthStart) };
    case "mes-anterior": {
      const start = shiftMonths(monthStart, -1);
      return { from: start, to: lastDayOfMonth(start) };
    }
    case "3-meses": {
      // Mês atual e os dois anteriores, completos.
      return { from: shiftMonths(monthStart, -2), to: lastDayOfMonth(monthStart) };
    }
    case "ano":
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case "ano-anterior":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case "personalizado": {
      const from = filters.de || null;
      const to = filters.ate || null;
      return from && to && from > to ? { from: to, to: from } : { from, to };
    }
    default:
      return { from: null, to: null };
  }
}

/**
 * Palavras da busca no mesmo formato do texto pesquisável salvo no recibo:
 * minúsculas, sem acento. No máximo 8 palavras de até 60 caracteres.
 */
export function searchTerms(query: string): string[] {
  return query
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((term) => term.slice(0, 60));
}
