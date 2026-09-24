import { DEFAULT_SETTINGS, type TemplateSettings } from "./constants";
import type { TemplateContent } from "./schema";

const v = (key: string, format?: "short" | "long") => ({
  type: "variable" as const,
  attrs: { key, ...(format ? { format } : {}) },
});
const t = (text: string) => ({ type: "text" as const, text });

/**
 * "Recibo padrão": ponto de partida elegante no formato da referência
 * (cabeçalho profissional, título, texto justificado, local/data e assinatura).
 * É um modelo comum — o usuário edita como quiser.
 */
export const DEFAULT_TEMPLATE_NAME = "Recibo padrão";

export const DEFAULT_TEMPLATE_CONTENT: TemplateContent = {
  type: "doc",
  content: [
    { type: "professionalHeader", attrs: { layout: "logo-left" } },
    { type: "horizontalRule" },
    {
      type: "paragraph",
      attrs: { textAlign: "center" },
      content: [
        {
          type: "text",
          text: "RECIBO DE HONORÁRIOS",
          marks: [{ type: "bold" }, { type: "textStyle", attrs: { fontSize: 16 } }],
        },
      ],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "justify" },
      content: [
        t("Recebi de "),
        v("pagador"),
        t(", CPF/CNPJ "),
        v("cpf_pagador"),
        t(", a importância de "),
        { ...v("valor"), marks: [{ type: "bold" }] },
        t(" ("),
        v("valor_extenso"),
        t("), referente aos honorários de instrumentação cirúrgica prestados ao(à) paciente "),
        v("paciente"),
        t(", CPF "),
        v("cpf_paciente"),
        t(", na cirurgia de "),
        v("cirurgia"),
        t(", realizada no "),
        v("hospital"),
        t(" em "),
        v("data_procedimento"),
        t("."),
      ],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "justify" },
      content: [t("Para maior clareza, firmo o presente recibo.")],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "right" },
      content: [v("cidade"), t(", "), v("data_emissao", "long"), t(".")],
    },
    { type: "signature", attrs: { align: "center", size: "medium", showName: true } },
  ],
};

export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = DEFAULT_SETTINGS;

export const BLANK_TEMPLATE_CONTENT: TemplateContent = {
  type: "doc",
  content: [
    { type: "professionalHeader", attrs: { layout: "logo-left" } },
    { type: "paragraph" },
    { type: "signature", attrs: { align: "center", size: "medium", showName: true } },
  ],
};
