import { z } from "zod";
import { UFS, documentTypeOf, isValidCnpj, isValidCpf, isValidPhone, onlyDigits } from "@/lib/format/br";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((value) => value || null);

export const professionalProfileSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe seu nome completo.").max(160, "Use no máximo 160 caracteres."),
    companyName: optionalText(160),
    profession: z.string().trim().min(2, "Informe sua profissão ou especialidade.").max(120),
    council: optionalText(40),
    registrationNumber: optionalText(40),
    document: z
      .string()
      .transform(onlyDigits)
      .refine((d) => d.length === 11 || d.length === 14, {
        message: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).",
        abort: true,
      })
      .refine((d) => (d.length === 11 ? isValidCpf(d) : isValidCnpj(d)), "Número inválido. Confira os dígitos."),
    phone: z.string().transform(onlyDigits).refine(isValidPhone, "Informe um telefone com DDD."),
    city: z.string().trim().min(2, "Informe a cidade.").max(80),
    state: z.enum(UFS, { error: "Selecione o estado." }),
  })
  // `when: () => true`: valida o par mesmo se outros campos tiverem erro, para
  // a pessoa ver todos os problemas de uma vez.
  .refine((data) => !(data.registrationNumber && !data.council), {
    path: ["council"],
    message: "Informe o conselho do registro (ex.: COREN-PE).",
    when: () => true,
  })
  .refine((data) => !(data.council && !data.registrationNumber), {
    path: ["registrationNumber"],
    message: "Informe o número do registro.",
    when: () => true,
  });

export type ProfessionalProfileInput = z.input<typeof professionalProfileSchema>;

export function toProfileRow(data: z.output<typeof professionalProfileSchema>) {
  return {
    full_name: data.fullName,
    company_name: data.companyName,
    profession: data.profession,
    council: data.council?.toUpperCase() ?? null,
    registration_number: data.registrationNumber,
    document_type: documentTypeOf(data.document),
    document_number: data.document,
    phone: data.phone,
    city: data.city,
    state: data.state,
  };
}

/** Sugestões comuns; o campo aceita qualquer conselho. */
export const COMMON_COUNCILS = [
  "COREN", "CRM", "CRO", "CRF", "CREFITO", "CRP", "CRN", "CRBM", "CRMV", "CREA", "CAU", "CRC", "OAB", "CREF", "CRFa",
];
