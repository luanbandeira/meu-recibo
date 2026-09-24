import { z } from "zod";
import { isReservedKey, VARIABLE_KEY_PATTERN, type FieldType } from "@/features/templates/document/variables";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Texto curto",
  long_text: "Texto longo",
  currency: "Moeda (R$)",
  number: "Número",
  date: "Data",
  document: "CPF/CNPJ",
  phone: "Telefone",
};

export const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

/** Tipos que aceitam valor padrão fixo (os demais variam a cada recibo). */
export const TYPES_WITH_DEFAULT: FieldType[] = ["short_text", "long_text", "currency", "number"];

const label = z.string().trim().min(2, "Dê um nome ao campo.").max(80, "Use no máximo 80 caracteres.");

const defaultValue = z
  .string()
  .trim()
  .max(2000, "Valor padrão muito longo.")
  .transform((v) => v || null)
  .nullable()
  .optional();

/** Valor padrão guardado normalizado: moeda em centavos, número com ponto decimal. */
export function normalizeDefault(type: FieldType, value: string | null | undefined): string | null {
  if (!value || !TYPES_WITH_DEFAULT.includes(type)) return null;
  if (type === "currency") {
    const digits = value.replace(/\D/g, "");
    return digits ? String(Number(digits)) : null;
  }
  if (type === "number") {
    const n = Number(value.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? String(n) : null;
  }
  return value;
}

export const createFieldSchema = z
  .object({
    label,
    key: z
      .string()
      .trim()
      .regex(VARIABLE_KEY_PATTERN, "Use letras minúsculas, números e _ (começando por letra), de 2 a 40 caracteres.")
      .refine((key) => !isReservedKey(key), "Este identificador é reservado pelo sistema."),
    type: z.enum(FIELD_TYPES as [FieldType, ...FieldType[]], { error: "Escolha o tipo do campo." }),
    required: z.boolean(),
    defaultValue,
  })
  .transform((data) => ({ ...data, defaultValue: normalizeDefault(data.type, data.defaultValue) }));

export const updateFieldSchema = z.object({
  id: z.uuid(),
  label,
  required: z.boolean(),
  defaultValue,
});
