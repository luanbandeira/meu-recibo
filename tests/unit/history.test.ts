import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, hasActiveFilters, historyHref, parseHistoryParams, periodRange, searchTerms } from "@/features/receipts/history";
import { flowPaths } from "@/features/receipts/flow";

describe("filtros do histórico na URL", () => {
  it("lê parâmetros válidos", () => {
    const filters = parseHistoryParams({
      q: "ana",
      periodo: "personalizado",
      de: "2026-01-01",
      ate: "2026-01-31",
      modelo: "0F9C2B1E-1111-4222-8333-944445555666",
      ordem: "valor",
      pagina: "3",
    });
    expect(filters).toEqual({
      q: "ana",
      periodo: "personalizado",
      de: "2026-01-01",
      ate: "2026-01-31",
      modelo: "0f9c2b1e-1111-4222-8333-944445555666",
      ordem: "valor",
      pagina: 3,
    });
  });

  it("descarta o que é inválido em vez de quebrar", () => {
    expect(
      parseHistoryParams({ periodo: "sempre", de: "2026-13-45", modelo: "x' or 1=1", ordem: "drop", pagina: "-2", q: ["a", "b"] }),
    ).toEqual({ ...EMPTY_FILTERS, q: "a" });
    expect(parseHistoryParams({ pagina: "abc" }).pagina).toBe(1);
    expect(parseHistoryParams({ q: "x".repeat(500) }).q).toHaveLength(200);
  });

  it("monta a URL omitindo o padrão e ida e volta preserva os filtros", () => {
    expect(historyHref(EMPTY_FILTERS)).toBe("/recibos");
    expect(historyHref({ ...EMPTY_FILTERS, periodo: "mes", de: "2026-01-01" })).toBe("/recibos?periodo=mes");
    const filters = { ...EMPTY_FILTERS, q: "josé silva", periodo: "personalizado" as const, de: "2026-02-01", ate: "2026-02-28", ordem: "pagador" as const, pagina: 2 };
    const url = new URL(historyHref(filters), "http://x");
    expect(parseHistoryParams(Object.fromEntries(url.searchParams))).toEqual(filters);
  });

  it("ordenação sozinha não conta como filtro ativo", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, ordem: "valor" })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: "  " })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, modelo: "x" })).toBe(true);
  });
});

describe("período", () => {
  const range = (periodo: string, today: string, de = "", ate = "") =>
    periodRange({ periodo: periodo as never, de, ate }, today);

  it.each([
    ["mes", "2026-09-24", "2026-09-01", "2026-09-30"],
    ["mes", "2024-02-10", "2024-02-01", "2024-02-29"],
    ["mes-anterior", "2026-01-15", "2025-12-01", "2025-12-31"],
    ["mes-anterior", "2026-03-31", "2026-02-01", "2026-02-28"],
    ["3-meses", "2026-02-10", "2025-12-01", "2026-02-28"],
    ["ano", "2026-09-24", "2026-01-01", "2026-12-31"],
    ["ano-anterior", "2026-09-24", "2025-01-01", "2025-12-31"],
  ])("%s em %s → %s a %s", (periodo, today, from, to) => {
    expect(range(periodo, today)).toEqual({ from, to });
  });

  it("personalizado aceita só um lado e inverte datas trocadas", () => {
    expect(range("personalizado", "2026-09-24", "2026-05-01")).toEqual({ from: "2026-05-01", to: null });
    expect(range("personalizado", "2026-09-24", "2026-05-31", "2026-05-01")).toEqual({ from: "2026-05-01", to: "2026-05-31" });
    expect(range("", "2026-09-24", "2026-05-01", "2026-05-31")).toEqual({ from: null, to: null });
  });
});

describe("palavras da busca", () => {
  it("normaliza como o texto salvo: minúsculas, sem acento", () => {
    expect(searchTerms("  JOSÉ   Conceição ")).toEqual(["jose", "conceicao"]);
    expect(searchTerms("529.982.247-25")).toEqual(["529.982.247-25"]);
    expect(searchTerms("")).toEqual([]);
  });

  it("limita quantidade e tamanho", () => {
    expect(searchTerms("a b c d e f g h i j")).toHaveLength(8);
    expect(searchTerms("x".repeat(100))[0]).toHaveLength(60);
  });
});

describe("fluxo emitir × corrigir", () => {
  it("rascunho e URLs separados para cada fluxo", () => {
    expect(flowPaths({ kind: "issue", templateId: "t1" })).toEqual({ draftId: "t1", form: "/emitir/t1", preview: "/emitir/t1/previa" });
    expect(flowPaths({ kind: "correct", receiptId: "r1", number: "REC-2026-000001", nextVersion: 2 })).toEqual({
      draftId: "correcao-r1",
      form: "/recibos/r1/corrigir",
      preview: "/recibos/r1/corrigir/previa",
    });
  });
});
