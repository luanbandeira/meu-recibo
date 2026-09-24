import { DEFAULT_SETTINGS, type TemplateSettings } from "./constants";
import type { TemplateContent } from "./schema";

// Modelos prontos: o ponto de partida que a pessoa escolhe na configuração
// inicial e em "Novo modelo". Depois de criado, é um modelo comum — cada conta
// guarda a própria cópia e edita como quiser (mudar aqui não afeta ninguém
// que já tem modelo).

const v = (key: string, format?: "short" | "long") => ({
  type: "variable" as const,
  attrs: { key, ...(format ? { format } : {}) },
});
const t = (text: string) => ({ type: "text" as const, text });
const amount = () => ({ ...v("valor"), marks: [{ type: "bold" as const }] });

const header = { type: "professionalHeader" as const, attrs: { layout: "logo-left" as const } };
const signature = { type: "signature" as const, attrs: { align: "center" as const, size: "medium" as const, showName: true } };
const title = (text: string) => ({
  type: "paragraph" as const,
  attrs: { textAlign: "center" as const },
  content: [{ type: "text" as const, text, marks: [{ type: "bold" as const }, { type: "textStyle" as const, attrs: { fontSize: 16 } }] }],
});
const body = (...content: object[]) => ({ type: "paragraph" as const, attrs: { textAlign: "justify" as const }, content });
const closing = body(t("Para maior clareza, firmo o presente recibo."));
const placeAndDate = {
  type: "paragraph" as const,
  attrs: { textAlign: "right" as const },
  content: [v("cidade"), t(", "), v("data_emissao", "long"), t(".")],
};

const doc = (...content: object[]) => ({ type: "doc", content }) as TemplateContent;

export const SERVICE_TEMPLATE_CONTENT = doc(
  header,
  title("RECIBO"),
  body(
    t("Recebi de "), v("pagador"), t(", CPF/CNPJ "), v("cpf_pagador"),
    t(", a importância de "), amount(), t(" ("), v("valor_extenso"), t("), referente a "), v("descricao_servico"), t("."),
  ),
  closing,
  placeAndDate,
  signature,
);

export const HEALTH_TEMPLATE_CONTENT = doc(
  header,
  title("RECIBO DE HONORÁRIOS"),
  body(
    t("Recebi de "), v("pagador"), t(", CPF/CNPJ "), v("cpf_pagador"),
    t(", a importância de "), amount(), t(" ("), v("valor_extenso"),
    t("), referente aos honorários profissionais pelo atendimento prestado ao(à) paciente "), v("paciente"),
    t(", CPF "), v("cpf_paciente"), t(", em "), v("data_procedimento"), t("."),
  ),
  closing,
  placeAndDate,
  signature,
);

export const SURGICAL_TEMPLATE_CONTENT = doc(
  header,
  title("RECIBO DE HONORÁRIOS"),
  body(
    t("Recebi de "), v("pagador"), t(", CPF/CNPJ "), v("cpf_pagador"),
    t(", a importância de "), amount(), t(" ("), v("valor_extenso"),
    t("), referente aos honorários de instrumentação cirúrgica prestados ao(à) paciente "), v("paciente"),
    t(", CPF "), v("cpf_paciente"), t(", na cirurgia de "), v("cirurgia"),
    t(", realizada no "), v("hospital"), t(" em "), v("data_procedimento"), t("."),
  ),
  closing,
  placeAndDate,
  signature,
);

export const BLANK_TEMPLATE_CONTENT = doc(header, { type: "paragraph" }, signature);

export type TemplatePresetKey = "servico" | "saude" | "cirurgia" | "branco";

export type TemplatePreset = {
  key: TemplatePresetKey;
  /** Nome do modelo criado. */
  name: string;
  /** Título do cartão na galeria. */
  title: string;
  audience: string;
  /** Prévia curta do texto, para escolher sem abrir o editor. */
  preview: string;
  content: TemplateContent;
};

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    key: "servico",
    name: "Recibo de serviço",
    title: "Prestação de serviço",
    audience: "Qualquer profissional autônomo",
    preview: "Recebi de [pagador], CPF/CNPJ [...], a importância de [valor] ([por extenso]), referente a [descrição do serviço].",
    content: SERVICE_TEMPLATE_CONTENT,
  },
  {
    key: "saude",
    name: "Recibo de atendimento",
    title: "Atendimento de saúde",
    audience: "Fisioterapia, psicologia, nutrição, consultas…",
    preview: "Recebi de [pagador] a importância de [valor], referente aos honorários pelo atendimento prestado ao(à) paciente [paciente], CPF [...], em [data].",
    content: HEALTH_TEMPLATE_CONTENT,
  },
  {
    key: "cirurgia",
    name: "Recibo cirúrgico",
    title: "Procedimento cirúrgico",
    audience: "Instrumentação e equipes cirúrgicas",
    preview: "Recebi de [pagador] a importância de [valor], referente aos honorários de instrumentação cirúrgica do(a) paciente [paciente], na cirurgia de [procedimento], no [hospital], em [data].",
    content: SURGICAL_TEMPLATE_CONTENT,
  },
  {
    key: "branco",
    name: "Meu recibo",
    title: "Em branco",
    audience: "Para escrever o próprio texto",
    preview: "Só o cabeçalho com seus dados e a assinatura.",
    content: BLANK_TEMPLATE_CONTENT,
  },
];

export const DEFAULT_PRESET_KEY: TemplatePresetKey = "servico";

/** Modelo pronto pela chave; qualquer valor desconhecido cai no padrão. */
export function templatePreset(key: unknown): TemplatePreset {
  return TEMPLATE_PRESETS.find((p) => p.key === key) ?? TEMPLATE_PRESETS.find((p) => p.key === DEFAULT_PRESET_KEY)!;
}

export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = DEFAULT_SETTINGS;
