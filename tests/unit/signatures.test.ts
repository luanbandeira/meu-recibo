import { describe, expect, it } from "vitest";
import { withSignatureMode } from "@/features/receipts/values";
import {
  SERVICE_WITH_CLIENT_TEMPLATE_CONTENT,
  TEMPLATE_PRESETS,
  templatePreset,
} from "@/features/templates/document/default-template";
import { templateContentSchema } from "@/features/templates/document/schema";
import {
  DEFAULT_NEW_SIGNERS,
  ME_SIGNER,
  effectiveMeMode,
  otherSigner,
  signatureFieldKeys,
  signatureModeOf,
  signatureRows,
  signersOf,
  usesDigitalSignature,
} from "@/features/templates/document/signatures";
import { emissionFieldKeys, extractVariables, isReservedKey } from "@/features/templates/document/variables";

const block = (attrs: Record<string, unknown>) => ({
  type: "doc",
  content: [{ type: "signature", attrs: { align: "center", size: "medium", showName: true, ...attrs } }],
});
const valid = (value: unknown) => templateContentSchema.safeParse(value).success;
const client = otherSigner({ name: { from: "field", key: "pagador" }, documentKey: "cpf_pagador", caption: "Cliente" });

describe("assinaturas: compatibilidade com o bloco antigo", () => {
  it("bloco sem lista (ex.: modelos já existentes) = só você, digital", () => {
    expect(signersOf({ showName: true })).toEqual([ME_SIGNER]);
    expect(signersOf({ showName: false, signers: null })).toEqual([{ ...ME_SIGNER, showName: false }]);
    expect(valid(block({ signers: null }))).toBe(true);
    expect(valid(block({}))).toBe(true);
    expect(extractVariables(block({}))).toEqual(["assinatura"]);
  });
});

describe("assinaturas: variáveis e campos de emissão", () => {
  it("nome e documento de outra pessoa viram campos do formulário", () => {
    const used = extractVariables(block({ signers: [ME_SIGNER, client] }));
    expect(used).toEqual(["assinatura", "pagador", "cpf_pagador"]);
    expect(emissionFieldKeys(used)).toEqual(["pagador", "cpf_pagador"]);
  });

  it("só pede a sua assinatura digital quando você assina de forma digital", () => {
    expect(extractVariables(block({ signers: [{ ...ME_SIGNER, mode: "manual" }] }))).toEqual([]);
    expect(usesDigitalSignature([otherSigner()])).toBe(false);
    expect(signatureFieldKeys([otherSigner({ name: { from: "text", text: "Clínica" } }), otherSigner()])).toEqual([]);
  });

  it("bloco novo nasce com 2 pessoas: você (digital) e quem paga", () => {
    expect(DEFAULT_NEW_SIGNERS).toHaveLength(2);
    expect(DEFAULT_NEW_SIGNERS[0]).toMatchObject({ who: "me", mode: "digital" });
    expect(DEFAULT_NEW_SIGNERS[1]).toMatchObject({ who: "other", name: { from: "field", key: "pagador" } });
    expect(valid(block({ signers: DEFAULT_NEW_SIGNERS }))).toBe(true);
  });

  it("a chave da escolha de assinatura é reservada (nenhum campo pode usar)", () => {
    expect(isReservedKey("assinatura_modo")).toBe(true);
  });
});

describe("assinaturas: validação (barreira do servidor)", () => {
  it.each<[string, unknown]>([
    ["mais de 4 pessoas", Array.from({ length: 5 }, () => otherSigner())],
    ["duas assinaturas suas", [ME_SIGNER, ME_SIGNER]],
    ["lista vazia", []],
    ["chave de campo inválida", [otherSigner({ name: { from: "field", key: "<script>" } })]],
    ["legenda longa demais", [{ ...ME_SIGNER, caption: "x".repeat(61) }]],
    ["texto fixo longo demais", [otherSigner({ name: { from: "text", text: "x".repeat(121) } })]],
    ["atributo desconhecido", [{ ...ME_SIGNER, html: "<b>" }]],
    ["modo inventado", [{ ...ME_SIGNER, mode: "carimbo" }]],
  ])("recusa: %s", (_, signers) => {
    expect(valid(block({ signers }))).toBe(false);
  });

  it("aceita até 4 pessoas, com uma sua", () => {
    const signers = [ME_SIGNER, client, otherSigner(), otherSigner({ name: { from: "text", text: "Testemunha" } })];
    expect(valid(block({ signers }))).toBe(true);
  });
});

describe("assinaturas: escolha na emissão", () => {
  it("digital só se o modelo pede, a emissão manteve e há imagem", () => {
    expect(effectiveMeMode(ME_SIGNER, "digital", true)).toBe("digital");
    expect(effectiveMeMode(ME_SIGNER, "manual", true)).toBe("manual");
    expect(effectiveMeMode(ME_SIGNER, "digital", false)).toBe("manual");
    expect(effectiveMeMode({ ...ME_SIGNER, mode: "manual" }, "digital", true)).toBe("manual");
  });

  it("recibos antigos (sem escolha) = digital; qualquer valor estranho = digital", () => {
    expect(signatureModeOf({})).toBe("digital");
    expect(signatureModeOf({ assinatura_modo: "manual" })).toBe("manual");
    expect(signatureModeOf({ assinatura_modo: "<x>" })).toBe("digital");
  });

  it("guarda a escolha só quando o modelo usa a sua assinatura digital", () => {
    expect(withSignatureMode({ valor: 1 }, { assinatura_modo: "manual" }, ["valor", "assinatura"])).toEqual({
      valor: 1,
      assinatura_modo: "manual",
    });
    expect(withSignatureMode({ valor: 1 }, { assinatura_modo: "manual" }, ["valor"])).toEqual({ valor: 1 });
    expect(withSignatureMode({}, {}, ["assinatura"])).toEqual({ assinatura_modo: "digital" });
  });

  it("3 ou 4 pessoas quebram em duas linhas de até 2", () => {
    expect(signatureRows([1])).toEqual([[1]]);
    expect(signatureRows([1, 2])).toEqual([[1, 2]]);
    expect(signatureRows([1, 2, 3])).toEqual([[1, 2], [3]]);
    expect(signatureRows([1, 2, 3, 4])).toEqual([[1, 2], [3, 4]]);
  });
});

describe("modelo pronto com assinatura do cliente", () => {
  it("está na galeria, é válido e pede nome e CPF/CNPJ do cliente", () => {
    expect(templatePreset("servico_cliente").content).toBe(SERVICE_WITH_CLIENT_TEMPLATE_CONTENT);
    expect(TEMPLATE_PRESETS.map((p) => p.key)).toContain("servico_cliente");
    expect(valid(SERVICE_WITH_CLIENT_TEMPLATE_CONTENT)).toBe(true);
    expect(extractVariables(SERVICE_WITH_CLIENT_TEMPLATE_CONTENT)).toEqual(
      expect.arrayContaining(["pagador", "cpf_pagador", "descricao_servico", "assinatura"]),
    );
  });
});
