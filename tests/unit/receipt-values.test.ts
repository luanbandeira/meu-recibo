import { describe, expect, it } from "vitest";
import {
  buildSummary,
  createResolver,
  emissionFields,
  formatValue,
  initialRawValues,
  maskInput,
  todayIso,
  validateValues,
} from "@/features/receipts/values";
import type { FieldDefinition, FieldType } from "@/features/templates/document/variables";

let order = 0;
const field = (key: string, type: FieldType, extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  id: key, key, label: key, type, required: false, default_value: null, is_system: true,
  sort_order: order++, archived_at: null, ...extra,
});

const fields = [
  field("valor", "currency", { required: true }),
  field("pagador", "short_text", { required: true }),
  field("cpf_pagador", "document"),
  field("paciente", "short_text"),
  field("data_procedimento", "date"),
  field("telefone_contato", "phone"),
  field("sessoes", "number"),
  field("cidade", "short_text", { required: true }),
  field("data_emissao", "date", { required: true }),
  field("obs", "long_text"),
];

const profile = {
  full_name: "Profissional Fictícia", company_name: null, profession: "Fisioterapeuta",
  council: "CREFITO-1", registration_number: "123456-F", document_type: "cpf" as const,
  document_number: "52998224725", phone: "81998765432", city: "Recife", state: "PE",
};

describe("campos da emissão", () => {
  it("segue a ordem do modelo e ignora perfil, automáticas e blocos", () => {
    const used = ["logo", "pagador", "valor", "valor_extenso", "profissional_nome", "data_emissao", "assinatura", "numero_recibo"];
    expect(emissionFields(used, fields).map((f) => f.key)).toEqual(["pagador", "valor", "data_emissao"]);
  });

  it("preenche hoje, a cidade do perfil e os valores padrão", () => {
    const withDefault = [...fields, field("honorario_base", "currency", { default_value: "35000" })];
    const values = initialRawValues(withDefault, { today: "2026-09-24", city: "Recife" });
    expect(values.data_emissao).toBe("2026-09-24");
    expect(values.cidade).toBe("Recife");
    expect(values.honorario_base).toBe("R$ 350,00");
    expect(values.pagador).toBe("");
  });

  it("ao duplicar, usa os valores do recibo anterior", () => {
    const values = initialRawValues(fields, { today: "2026-09-24", city: "Recife" }, { valor: 50000, cpf_pagador: "52998224725", data_emissao: "2026-01-02" });
    expect(values.valor).toBe("R$ 500,00");
    expect(values.cpf_pagador).toBe("529.982.247-25");
    expect(values.data_emissao).toBe("2026-01-02");
  });

  it("data de hoje no fuso do profissional", () => {
    // 02:30 UTC de 25/09 ainda é 24/09 em São Paulo (UTC-3).
    expect(todayIso("America/Sao_Paulo", new Date("2026-09-25T02:30:00Z"))).toBe("2026-09-24");
    expect(todayIso("America/Noronha", new Date("2026-09-25T02:30:00Z"))).toBe("2026-09-25");
  });

  it("máscaras de digitação", () => {
    expect(maskInput("currency", "123456")).toBe("R$ 1.234,56");
    expect(maskInput("document", "52998224725")).toBe("529.982.247-25");
    expect(maskInput("phone", "81998765432")).toBe("(81) 99876-5432");
  });
});

describe("validação e normalização", () => {
  const valid = {
    valor: "R$ 1.234,56", pagador: " Pagador Fictício ", cpf_pagador: "529.982.247-25", paciente: "",
    data_procedimento: "2026-09-20", telefone_contato: "(81) 99876-5432", sessoes: "2,5", cidade: "Recife",
    data_emissao: "2026-09-24", obs: "",
  };

  it("normaliza para o formato salvo", () => {
    const result = validateValues(fields, valid);
    expect(result).toEqual({
      ok: true,
      values: {
        valor: 123456, pagador: "Pagador Fictício", cpf_pagador: "52998224725", paciente: null,
        data_procedimento: "2026-09-20", telefone_contato: "81998765432", sessoes: 2.5, cidade: "Recife",
        data_emissao: "2026-09-24", obs: null,
      },
    });
  });

  it("aponta cada erro no seu campo", () => {
    const result = validateValues(fields, {
      ...valid, valor: "", pagador: "  ", cpf_pagador: "529.982.247-24", data_procedimento: "2026-02-30",
      telefone_contato: "9999", sessoes: "abc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        valor: "Preencha este campo.",
        pagador: "Preencha este campo.",
        cpf_pagador: "Número inválido. Confira os dígitos.",
        data_procedimento: "Informe uma data válida.",
        telefone_contato: "Informe um telefone com DDD.",
        sessoes: "Informe um número.",
      });
    }
  });

  it("campo opcional vazio não é erro", () => {
    const result = validateValues(fields, { ...valid, cpf_pagador: "", telefone_contato: "", sessoes: "" });
    expect(result.ok).toBe(true);
  });
});

describe("formatação no documento", () => {
  it("formata cada tipo", () => {
    expect(formatValue("currency", 50000)).toBe("R$ 500,00");
    expect(formatValue("date", "2026-09-23")).toBe("23/09/2026");
    expect(formatValue("date", "2026-09-23", "long")).toBe("23 de setembro de 2026");
    expect(formatValue("document", "11444777000161")).toBe("11.444.777/0001-61");
    expect(formatValue("number", 2.5)).toBe("2,5");
    expect(formatValue("short_text", null)).toBe("");
  });

  it("resolve perfil, número do recibo e valor por extenso", () => {
    const resolve = createResolver({ fields, values: { valor: 50000, pagador: "Fulano" }, profile, receiptNumber: "REC-2026-000001" });
    expect(resolve("valor").text).toBe("R$ 500,00");
    expect(resolve("valor_extenso").text).toBe("quinhentos reais");
    expect(resolve("profissional_registro").text).toBe("CREFITO-1 123456-F");
    expect(resolve("numero_recibo").text).toBe("REC-2026-000001");
    expect(resolve("paciente")).toEqual({ text: "", missing: true });
    expect(resolve("campo_inexistente").missing).toBe(true);
  });
});

describe("resumo para o histórico", () => {
  it("usa pagador, valor e data do procedimento; texto de busca sem acentos", () => {
    const summary = buildSummary(fields, {
      valor: 50000, pagador: "José Pagador", cpf_pagador: "52998224725", paciente: "Maria Paciente",
      data_procedimento: "2026-09-20", cidade: "Recife", data_emissao: "2026-09-24",
    });
    expect(summary).toEqual({
      payer_name: "José Pagador",
      amount_cents: 50000,
      service_date: "2026-09-20",
      search_text: "jose pagador 52998224725 maria paciente recife",
    });
  });

  it("sem pagador, usa o paciente; sem data do procedimento, a de emissão", () => {
    const summary = buildSummary(fields, { paciente: "Maria", data_emissao: "2026-09-24" });
    expect(summary.payer_name).toBe("Maria");
    expect(summary.service_date).toBe("2026-09-24");
    expect(summary.amount_cents).toBeNull();
  });
});
