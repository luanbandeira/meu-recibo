import { formatCpfCnpj, formatPhone } from "@/lib/format/br";

// Dados do perfil usados nos documentos. Função pura: editor e PDF usam a mesma.

export type DocumentProfile = {
  full_name: string;
  company_name: string | null;
  profession: string | null;
  council: string | null;
  registration_number: string | null;
  document_type: "cpf" | "cnpj" | null;
  document_number: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
};

export function registrationText(p: DocumentProfile): string {
  return [p.council, p.registration_number].filter(Boolean).join(" ");
}

export function phoneLabel(phone: string | null) {
  return phone && phone.length === 11 ? "Celular" : "Telefone";
}

/** Linhas do cabeçalho profissional, no formato da referência. */
export function headerLines(p: DocumentProfile) {
  const documentText = p.document_number
    ? `${p.document_type === "cnpj" ? "CNPJ" : "CPF"}: ${formatCpfCnpj(p.document_number)}`
    : null;
  const phoneText = p.phone ? `${phoneLabel(p.phone)}: ${formatPhone(p.phone)}` : null;

  return {
    name: p.full_name,
    company: p.company_name,
    professionLine: [p.profession, registrationText(p)].filter(Boolean).join(" - ") || null,
    contactLine: [documentText, phoneText].filter(Boolean).join(" - ") || null,
  };
}

/**
 * Linha sob a SUA assinatura: só o documento ("CPF: …" / "CNPJ: …"). Profissão
 * e registro não entram — já vêm no carimbo da imagem da assinatura.
 */
export function signatureDocumentLine(p: DocumentProfile): string | null {
  return p.document_number ? `${p.document_type === "cnpj" ? "CNPJ" : "CPF"}: ${formatCpfCnpj(p.document_number)}` : null;
}

/** Valores das variáveis {{profissional_*}}. */
export function profileVariableValues(p: DocumentProfile): Record<string, string> {
  return {
    profissional_nome: p.full_name,
    profissional_profissao: p.profession ?? "",
    profissional_registro: registrationText(p),
    profissional_cpf_cnpj: p.document_number ? formatCpfCnpj(p.document_number) : "",
    profissional_telefone: p.phone ? formatPhone(p.phone) : "",
    profissional_razao_social: p.company_name ?? "",
    profissional_cidade: p.city ?? "",
    profissional_estado: p.state ?? "",
  };
}
