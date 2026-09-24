// Catálogo de variáveis dos modelos.
//
// - Campos de emissão: vêm da tabela `fields` do usuário (padrão + personalizados)
//   e viram o formulário de emissão.
// - Perfil e automáticas: preenchidas pelo sistema, nunca pedidas no formulário.
// - Logo e assinatura: são blocos próprios do editor (não variáveis de texto).

export const VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

export type FieldType = "short_text" | "long_text" | "currency" | "number" | "date" | "document" | "phone";

export type FieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  default_value: string | null;
  is_system: boolean;
  sort_order: number;
  archived_at: string | null;
};

export type CatalogVariable = {
  key: string;
  label: string;
  group: "fields" | "profile" | "auto";
  type?: FieldType;
};

export const PROFILE_VARIABLES: CatalogVariable[] = [
  { key: "profissional_nome", label: "Seu nome", group: "profile" },
  { key: "profissional_profissao", label: "Sua profissão", group: "profile" },
  { key: "profissional_registro", label: "Seu registro (conselho e número)", group: "profile" },
  { key: "profissional_cpf_cnpj", label: "Seu CPF/CNPJ", group: "profile" },
  { key: "profissional_telefone", label: "Seu telefone", group: "profile" },
  { key: "profissional_razao_social", label: "Sua razão social", group: "profile" },
  { key: "profissional_cidade", label: "Sua cidade", group: "profile" },
  { key: "profissional_estado", label: "Seu estado (UF)", group: "profile" },
];

export const AUTO_VARIABLES: CatalogVariable[] = [
  { key: "numero_recibo", label: "Número do recibo", group: "auto" },
  { key: "valor_extenso", label: "Valor por extenso", group: "auto" },
];

/** Variáveis que viram campos do formulário de emissão (exclui perfil, automáticas e blocos). */
export function emissionFieldKeys(usedVariables: string[]): string[] {
  const auto = new Set([...AUTO_VARIABLES, ...PROFILE_VARIABLES].map((v) => v.key));
  return usedVariables.filter((key) => key !== "logo" && key !== "assinatura" && !auto.has(key));
}

/** Chaves que o usuário não pode usar em campos personalizados. */
export function isReservedKey(key: string) {
  return key.startsWith("profissional_") || ["numero_recibo", "valor_extenso", "logo", "assinatura"].includes(key);
}

export function buildCatalog(fields: FieldDefinition[]): CatalogVariable[] {
  const active = fields
    .filter((f) => !f.archived_at)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => ({ key: f.key, label: f.label, group: "fields" as const, type: f.type }));
  return [...active, ...PROFILE_VARIABLES, ...AUTO_VARIABLES];
}

/** Todas as chaves válidas para o usuário (inclui campos arquivados já usados em modelos). */
export function knownKeys(fields: FieldDefinition[]): Set<string> {
  return new Set([...fields.map((f) => f.key), ...PROFILE_VARIABLES.map((v) => v.key), ...AUTO_VARIABLES.map((v) => v.key)]);
}

type Node = { type?: string; attrs?: Record<string, unknown>; content?: Node[] };

/**
 * Variáveis e blocos especiais usados no documento, na ordem em que aparecem.
 * Blocos: `logo`, `assinatura` e o cabeçalho (que usa logo + dados do perfil).
 */
export function extractVariables(doc: object): string[] {
  const found: string[] = [];
  const add = (key: string) => {
    if (!found.includes(key)) found.push(key);
  };
  const walk = (node: Node) => {
    if (node.type === "variable" && typeof node.attrs?.key === "string") add(node.attrs.key);
    if (node.type === "logo") add("logo");
    if (node.type === "signature") add("assinatura");
    if (node.type === "professionalHeader" && node.attrs?.layout !== "no-logo") add("logo");
    node.content?.forEach(walk);
  };
  walk(doc as Node);
  return found;
}

/** Sugere o identificador a partir do nome do campo ("Nome do cirurgião" → "nome_do_cirurgiao"). */
export function suggestFieldKey(label: string): string {
  const key = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9_]+/, "")
    .slice(0, 40)
    .replace(/_+$/, "");
  return key;
}
