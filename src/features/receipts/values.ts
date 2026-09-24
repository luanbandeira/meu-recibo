// Valores de um recibo: do formulário (texto digitado) → normalizados (o que
// é salvo) → formatados (o que aparece no documento). Funções puras,
// usadas no navegador (formulário/prévia) e no servidor (emissão/PDF).

import type { FieldDefinition, FieldType } from "@/features/templates/document/variables";
import { emissionFieldKeys } from "@/features/templates/document/variables";
import { profileVariableValues, type DocumentProfile } from "@/features/templates/document/profile-values";
import { formatCpfCnpj, formatPhone, isValidCnpj, isValidCpf, isValidPhone, onlyDigits } from "@/lib/format/br";
import { centsToWords } from "@/lib/format/extenso";
import { formatBRL, maskBRLInput } from "@/lib/format/money";

/** O que o formulário guarda (texto exibido nos campos). */
export type RawValues = Record<string, string>;
/** O que é salvo: moeda em centavos, datas ISO, CPF/CNPJ e telefone só dígitos. */
export type NormalizedValue = string | number | null;
export type NormalizedValues = Record<string, NormalizedValue>;

const MAX_LENGTH: Partial<Record<FieldType, number>> = { short_text: 200, long_text: 2000 };

/** Campos pedidos na emissão, na ordem em que aparecem no modelo. */
export function emissionFields(usedVariables: string[], fields: FieldDefinition[]): FieldDefinition[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  return emissionFieldKeys(usedVariables)
    .map((key) => byKey.get(key))
    .filter((f): f is FieldDefinition => Boolean(f));
}

/** Data de hoje (AAAA-MM-DD) no fuso do profissional. */
export function todayIso(timeZone = "America/Sao_Paulo", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Converte um valor salvo para o texto que aparece no campo do formulário. */
export function toInputValue(type: FieldType, value: NormalizedValue | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  switch (type) {
    case "currency":
      return formatBRL(Number(value));
    case "number":
      return String(value).replace(".", ",");
    case "document":
      return formatCpfCnpj(String(value));
    case "phone":
      return formatPhone(String(value));
    default:
      return String(value);
  }
}

/** Máscara aplicada enquanto a pessoa digita. */
export function maskInput(type: FieldType, raw: string): string {
  switch (type) {
    case "currency":
      return maskBRLInput(raw).display;
    case "document":
      return formatCpfCnpj(raw);
    case "phone":
      return formatPhone(raw);
    case "number":
      return raw.replace(/[^\d,.-]/g, "");
    default:
      return raw;
  }
}

/** Valores iniciais: salvos anteriormente (duplicar/corrigir) > padrão do campo > automáticos. */
export function initialRawValues(
  fields: FieldDefinition[],
  context: { today: string; city: string | null },
  previous?: NormalizedValues,
): RawValues {
  const values: RawValues = {};
  for (const field of fields) {
    if (previous && field.key in previous) {
      values[field.key] = toInputValue(field.type, previous[field.key]);
    } else if (field.key === "data_emissao") {
      values[field.key] = context.today;
    } else if (field.key === "cidade" && context.city) {
      values[field.key] = context.city;
    } else {
      values[field.key] = toInputValue(field.type, field.default_value);
    }
  }
  return values;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  const year = date.getUTCFullYear();
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && year >= 1900 && year <= 2100;
}

export type ValidationResult =
  | { ok: true; values: NormalizedValues }
  | { ok: false; errors: Record<string, string> };

/** Valida e normaliza. Mesma função no navegador e no servidor. */
export function validateValues(fields: FieldDefinition[], raw: RawValues): ValidationResult {
  const values: NormalizedValues = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const input = (raw[field.key] ?? "").trim();
    if (!input) {
      if (field.required) errors[field.key] = "Preencha este campo.";
      values[field.key] = null;
      continue;
    }

    switch (field.type) {
      case "currency": {
        const { cents } = maskBRLInput(input);
        if (cents === null) errors[field.key] = "Informe um valor.";
        else values[field.key] = cents;
        break;
      }
      case "number": {
        const n = Number(input.replace(/\./g, "").replace(",", "."));
        if (!Number.isFinite(n)) errors[field.key] = "Informe um número.";
        else values[field.key] = n;
        break;
      }
      case "date": {
        if (!isValidIsoDate(input)) errors[field.key] = "Informe uma data válida.";
        else values[field.key] = input;
        break;
      }
      case "document": {
        const digits = onlyDigits(input);
        const valid = digits.length === 11 ? isValidCpf(digits) : digits.length === 14 ? isValidCnpj(digits) : false;
        if (!valid) {
          errors[field.key] =
            digits.length === 11 || digits.length === 14 ? "Número inválido. Confira os dígitos." : "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
        } else values[field.key] = digits;
        break;
      }
      case "phone": {
        if (!isValidPhone(input)) errors[field.key] = "Informe um telefone com DDD.";
        else values[field.key] = onlyDigits(input);
        break;
      }
      default: {
        const max = MAX_LENGTH[field.type] ?? 200;
        if (input.length > max) errors[field.key] = `Use no máximo ${max} caracteres.`;
        else values[field.key] = input;
      }
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });

/** Texto que aparece no documento para um valor salvo. */
export function formatValue(type: FieldType, value: NormalizedValue, format?: "short" | "long" | null): string {
  if (value === null || value === "") return "";
  switch (type) {
    case "currency":
      return formatBRL(Number(value));
    case "number":
      return numberFormat.format(Number(value));
    case "date": {
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return String(value);
      return (format === "long" ? longDate : shortDate).format(date);
    }
    case "document":
      return formatCpfCnpj(String(value));
    case "phone":
      return formatPhone(String(value));
    default:
      return String(value);
  }
}

export type ResolvedVariable = { text: string; missing: boolean };

/**
 * Resolve todas as variáveis de um documento: campos de emissão, dados do
 * perfil e automáticas (número do recibo, valor por extenso).
 */
export function createResolver(params: {
  fields: FieldDefinition[];
  values: NormalizedValues;
  profile: DocumentProfile;
  receiptNumber: string | null;
}) {
  const byKey = new Map(params.fields.map((f) => [f.key, f]));
  const profileValues = profileVariableValues(params.profile);
  const valor = params.values.valor;

  return (key: string, format?: "short" | "long" | null): ResolvedVariable => {
    if (key in profileValues) return { text: profileValues[key], missing: !profileValues[key] };
    if (key === "numero_recibo") return { text: params.receiptNumber ?? "", missing: !params.receiptNumber };
    if (key === "valor_extenso") {
      const ok = typeof valor === "number";
      return { text: ok ? centsToWords(valor) : "", missing: !ok };
    }
    const field = byKey.get(key);
    const value = params.values[key] ?? null;
    if (!field) return { text: "", missing: true };
    const text = formatValue(field.type, value, format);
    return { text, missing: !text };
  };
}

function searchable(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resumo do recibo para o histórico (listagem, busca, ordenação):
 * quem pagou, quanto, data do serviço e texto pesquisável.
 */
export function buildSummary(fields: FieldDefinition[], values: NormalizedValues) {
  const firstOfType = (type: FieldType, exclude: string[] = []) =>
    fields.find((f) => f.type === type && !exclude.includes(f.key) && values[f.key] !== null && values[f.key] !== undefined);

  const payerField =
    ["pagador", "paciente"].map((key) => fields.find((f) => f.key === key && values[key])).find(Boolean) ??
    firstOfType("short_text", ["cidade"]);
  const amountField = fields.find((f) => f.key === "valor" && typeof values.valor === "number") ?? firstOfType("currency");
  const dateField =
    fields.find((f) => f.key === "data_procedimento" && values.data_procedimento) ??
    firstOfType("date", ["data_emissao"]) ??
    fields.find((f) => f.key === "data_emissao" && values.data_emissao);

  const searchParts = fields
    .filter((f) => ["short_text", "long_text", "document"].includes(f.type) && values[f.key])
    .map((f) => String(values[f.key]));

  return {
    payer_name: payerField ? String(values[payerField.key]).slice(0, 200) : null,
    amount_cents: amountField ? Number(values[amountField.key]) : null,
    service_date: dateField ? String(values[dateField.key]) : null,
    search_text: searchable(searchParts.join(" ")).slice(0, 4000),
  };
}
