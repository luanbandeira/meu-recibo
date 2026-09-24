import { describe, expect, it } from "vitest";
import { auditDetails, auditHref, auditQuery, parseAuditParams } from "@/features/audit/filters";

const USER = "0f9c2b1e-1111-4222-8333-944445555666";

describe("filtros da auditoria", () => {
  it("lê parâmetros válidos e descarta o resto", () => {
    expect(parseAuditParams({ acao: "pdf", periodo: "30d", usuario: USER.toUpperCase(), pagina: "2" })).toEqual({
      acao: "pdf",
      periodo: "30d",
      usuario: USER,
      pagina: 2,
    });
    expect(parseAuditParams({ acao: "admin.%", periodo: "1d", usuario: "x", pagina: "-1" })).toEqual({
      acao: "",
      periodo: "",
      usuario: "",
      pagina: 1,
    });
  });

  it("ida e volta pela URL preserva os filtros", () => {
    const filters = { acao: "suporte" as const, periodo: "7d" as const, usuario: USER, pagina: 3 };
    const url = new URL(auditHref(filters), "http://x");
    expect(parseAuditParams(Object.fromEntries(url.searchParams))).toEqual(filters);
    expect(auditHref({ acao: "", periodo: "", usuario: "", pagina: 1 })).toBe("/admin/auditoria");
  });

  it("converte em prefixo de ação, início do período e deslocamento", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(auditQuery({ acao: "pdf", periodo: "7d", usuario: USER, pagina: 2 }, now)).toEqual({
      actionPrefix: "admin.support.view_pdf",
      targetUserId: USER,
      from: "2026-09-17T12:00:00.000Z",
      offset: 30,
    });
    expect(auditQuery({ acao: "", periodo: "", usuario: "", pagina: 1 }, now)).toEqual({
      actionPrefix: null,
      targetUserId: null,
      from: null,
      offset: 0,
    });
  });
});

describe("detalhes de cada registro", () => {
  it("mostra motivo do suporte, documento visto e usuário criado", () => {
    expect(auditDetails({ action: "admin.support.start", metadata: {}, support_reason: "ajuda com o modelo" })).toBe(
      "Motivo: “ajuda com o modelo”",
    );
    expect(
      auditDetails({ action: "admin.support.view_pdf", metadata: { number: "REC-2026-000001", version: 2, download: true }, support_reason: null }),
    ).toBe("REC-2026-000001 · versão 2 · baixou o arquivo");
    expect(auditDetails({ action: "admin.support.view_pdf", metadata: { number: "REC-2026-000001", version: 1 }, support_reason: null })).toBe(
      "REC-2026-000001",
    );
    expect(auditDetails({ action: "admin.user.create", metadata: { username: "maria" }, support_reason: null })).toBe("Usuário @maria");
    expect(auditDetails({ action: "admin.user.disable", metadata: {}, support_reason: null })).toBeNull();
    expect(auditDetails({ action: "user.receipt.delete", metadata: { number: "REC-2026-000004", versions: 2 }, support_reason: null })).toBe(
      "REC-2026-000004 (2 versões)",
    );
    expect(auditDetails({ action: "admin.user.delete", metadata: { receipts: 1, files: 12 }, support_reason: null })).toBe(
      "Apagados: 1 recibo e 12 arquivos (dados pessoais removidos, LGPD)",
    );
  });
});
