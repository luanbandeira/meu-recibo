import { describe, expect, it } from "vitest";
import { BLANK_TEMPLATE_CONTENT, DEFAULT_TEMPLATE_CONTENT } from "@/features/templates/document/default-template";
import { templateContentSchema, templateSettingsSchema } from "@/features/templates/document/schema";
import {
  buildCatalog,
  extractVariables,
  isReservedKey,
  suggestFieldKey,
  type FieldDefinition,
} from "@/features/templates/document/variables";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const valid = (value: unknown) => templateContentSchema.safeParse(value).success;

describe("schema do documento (barreira contra XSS e conteúdo malformado)", () => {
  it("aceita os modelos padrão e em branco", () => {
    expect(valid(DEFAULT_TEMPLATE_CONTENT)).toBe(true);
    expect(valid(BLANK_TEMPLATE_CONTENT)).toBe(true);
  });

  it("aceita a forma que o TipTap produz (atributos nulos, listas, títulos)", () => {
    expect(
      valid(
        doc(
          { type: "paragraph", attrs: { textAlign: null, lineHeight: null } },
          { type: "heading", attrs: { level: 2, textAlign: "center", lineHeight: null }, content: [{ type: "text", text: "Título" }] },
          { type: "bulletList", content: [{ type: "listItem", content: [p({ type: "text", text: "item" })] }] },
          { type: "orderedList", attrs: { start: 1, type: null }, content: [{ type: "listItem", content: [p()] }] },
          p({ type: "text", text: "x", marks: [{ type: "textStyle", attrs: { fontFamily: null, fontSize: 14 } }] }, { type: "hardBreak" }),
        ),
      ),
    ).toBe(true);
  });

  it("recusa nós que não existem no editor (HTML, imagens externas, iframes)", () => {
    expect(valid(doc({ type: "html", content: "<script>alert(1)</script>" }))).toBe(false);
    expect(valid(doc({ type: "image", attrs: { src: "https://evil.example/x.png" } }))).toBe(false);
    expect(valid(doc(p({ type: "iframe", attrs: { src: "javascript:alert(1)" } })))).toBe(false);
  });

  it("recusa marcas não permitidas, como links", () => {
    expect(valid(doc(p({ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] })))).toBe(false);
  });

  it("recusa injeção de CSS pelos atributos de estilo", () => {
    const style = (attrs: unknown) => doc(p({ type: "text", text: "x", marks: [{ type: "textStyle", attrs }] }));
    expect(valid(style({ fontFamily: "arial;background:url(//evil)" }))).toBe(false);
    expect(valid(style({ fontSize: 13.5 }))).toBe(false);
    expect(valid(style({ color: "red" }))).toBe(false);
    expect(valid(doc({ type: "paragraph", attrs: { textAlign: "left;position:fixed" } }))).toBe(false);
    expect(valid(doc({ type: "paragraph", attrs: { style: "color:red" } }))).toBe(false);
  });

  it("recusa chaves de variável inválidas e atributos extras em blocos", () => {
    expect(valid(doc(p({ type: "variable", attrs: { key: "<img onerror=x>" } })))).toBe(false);
    expect(valid(doc({ type: "logo", attrs: { align: "center", size: "medium", src: "https://x" } }))).toBe(false);
    expect(valid(doc({ type: "professionalHeader", attrs: { layout: "qualquer" } }))).toBe(false);
  });

  it("texto com '<script>' é só texto (será exibido escapado, nunca executado)", () => {
    expect(valid(doc(p({ type: "text", text: "<script>alert(1)</script>" })))).toBe(true);
  });

  it("limita tamanho e profundidade", () => {
    const huge = doc(...Array.from({ length: 501 }, () => p()));
    expect(valid(huge)).toBe(false);
    const nest = (depth: number): unknown =>
      depth === 0 ? p() : { type: "bulletList", content: [{ type: "listItem", content: [p(), nest(depth - 1)] }] };
    expect(valid(doc(nest(3)))).toBe(true);
    expect(valid(doc(nest(4)))).toBe(false);
  });

  it("valida configurações do modelo", () => {
    expect(templateSettingsSchema.safeParse({ fontFamily: "arimo", fontSize: 12, lineHeight: 1.5, margins: "normal" }).success).toBe(true);
    expect(templateSettingsSchema.safeParse({ fontFamily: "comic", fontSize: 12, lineHeight: 1.5, margins: "normal" }).success).toBe(false);
  });
});

describe("variáveis", () => {
  it("extrai variáveis e blocos na ordem do documento, sem repetir", () => {
    expect(extractVariables(DEFAULT_TEMPLATE_CONTENT)).toEqual([
      "logo",
      "pagador",
      "cpf_pagador",
      "valor",
      "valor_extenso",
      "paciente",
      "cpf_paciente",
      "cirurgia",
      "hospital",
      "data_procedimento",
      "cidade",
      "data_emissao",
      "assinatura",
    ]);
  });

  it("cabeçalho sem logo não exige logo", () => {
    expect(extractVariables(doc({ type: "professionalHeader", attrs: { layout: "no-logo" } }))).toEqual([]);
  });

  it("catálogo: campos ativos em ordem, depois perfil e automáticas", () => {
    const field = (key: string, sort: number, archived = false): FieldDefinition => ({
      id: key, key, label: key, type: "short_text", required: false, default_value: null,
      is_system: false, sort_order: sort, archived_at: archived ? "2026-01-01" : null,
    });
    const catalog = buildCatalog([field("b", 20), field("a", 10), field("velho", 5, true)]);
    expect(catalog.slice(0, 2).map((v) => v.key)).toEqual(["a", "b"]);
    expect(catalog.some((v) => v.key === "velho")).toBe(false);
    expect(catalog.some((v) => v.key === "profissional_nome")).toBe(true);
  });

  it("sugere identificador e protege chaves reservadas", () => {
    expect(suggestFieldKey("Nome do cirurgião")).toBe("nome_do_cirurgiao");
    expect(suggestFieldKey("  Nº da guia (convênio) ")).toBe("n_da_guia_convenio");
    expect(suggestFieldKey("123 teste")).toBe("teste");
    expect(isReservedKey("profissional_nome")).toBe(true);
    expect(isReservedKey("assinatura")).toBe(true);
    expect(isReservedKey("cirurgiao")).toBe(false);
  });
});
