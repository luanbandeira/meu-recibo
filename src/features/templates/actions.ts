"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS } from "./document/constants";
import { BLANK_TEMPLATE_CONTENT, DEFAULT_TEMPLATE_CONTENT } from "./document/default-template";
import { templateContentSchema, templateSettingsSchema } from "./document/schema";
import { extractVariables, knownKeys } from "./document/variables";

const nameSchema = z.string().trim().min(1, "Dê um nome ao modelo.").max(100, "Use no máximo 100 caracteres.");
const idSchema = z.uuid();

function revalidateTemplates() {
  revalidatePath("/modelos", "layout");
}

// ----------------------------------------------------------------------------
// Criar / duplicar / renomear / arquivar / excluir
// ----------------------------------------------------------------------------

export type CreateTemplateState = { error?: string };

export async function createTemplate(_prev: CreateTemplateState, formData: FormData): Promise<CreateTemplateState> {
  const { userId } = await requireOnboardedUser();
  const name = nameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!name.success) return { error: name.error.issues[0].message };
  const base = formData.get("base") === "blank" ? "blank" : "default";

  const supabase = await createClient();
  const content = base === "blank" ? BLANK_TEMPLATE_CONTENT : DEFAULT_TEMPLATE_CONTENT;
  const { data, error } = await supabase
    .from("receipt_templates")
    .insert({
      user_id: userId,
      name: name.data,
      content,
      settings: DEFAULT_SETTINGS,
      used_variables: extractVariables(content),
    })
    .select("id")
    .single();
  if (error) return { error: "Não foi possível criar o modelo." };

  revalidateTemplates();
  redirect(`/modelos/${data.id}/editar`);
}

export async function duplicateTemplate(id: string): Promise<{ ok: boolean }> {
  const { userId } = await requireOnboardedUser();
  if (!idSchema.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { data: source } = await supabase
    .from("receipt_templates")
    .select("name, content, settings, used_variables")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!source) return { ok: false };

  const { error } = await supabase.from("receipt_templates").insert({
    user_id: userId,
    name: `Cópia de ${source.name}`.slice(0, 100),
    content: source.content,
    settings: source.settings,
    used_variables: source.used_variables,
  });
  revalidateTemplates();
  return { ok: !error };
}

export async function renameTemplate(id: string, rawName: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireOnboardedUser();
  const name = nameSchema.safeParse(rawName);
  if (!idSchema.safeParse(id).success || !name.success) {
    return { ok: false, error: name.success ? undefined : name.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("receipt_templates").update({ name: name.data }).eq("id", id).eq("user_id", userId);
  revalidateTemplates();
  return { ok: !error };
}

export async function setTemplateArchived(id: string, archived: boolean): Promise<{ ok: boolean }> {
  const { userId } = await requireOnboardedUser();
  if (!idSchema.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("receipt_templates")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", id)
    .eq("user_id", userId);
  revalidateTemplates();
  return { ok: !error };
}

/** Exclusão só de modelos arquivados. Recibos já emitidos guardam cópia do modelo. */
export async function deleteTemplate(id: string): Promise<{ ok: boolean }> {
  const { userId } = await requireOnboardedUser();
  if (!idSchema.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("receipt_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "archived");
  revalidateTemplates();
  return { ok: !error };
}

// ----------------------------------------------------------------------------
// Salvamento do editor (autosave com controle de revisão)
// ----------------------------------------------------------------------------

export type SaveTemplateResult =
  | { ok: true; revision: number; usedVariables: string[] }
  | { ok: false; conflict: true }
  | { ok: false; conflict?: false; error: string };

/** Tamanho máximo do documento serializado (a coluna também limita em 512 KB). */
const MAX_CONTENT_JSON = 500_000;

/**
 * O documento chega como TEXTO JSON: o ProseMirror cria atributos como objetos
 * sem protótipo, que o React não serializa em Server Actions. Texto + parse
 * aqui garante que validamos exatamente o que será salvo.
 */
export async function saveTemplate(input: {
  id: string;
  revision: number;
  contentJson: string;
  settings: unknown;
}): Promise<SaveTemplateResult> {
  const { userId } = await requireOnboardedUser();
  if (
    !idSchema.safeParse(input.id).success ||
    !Number.isInteger(input.revision) ||
    typeof input.contentJson !== "string" ||
    input.contentJson.length > MAX_CONTENT_JSON
  ) {
    return { ok: false, error: "Modelo inválido ou grande demais." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.contentJson);
  } catch {
    return { ok: false, error: "Conteúdo do modelo corrompido." };
  }

  const content = templateContentSchema.safeParse(parsedJson);
  const settings = templateSettingsSchema.safeParse(input.settings);
  if (!content.success || !settings.success) {
    // Só a estrutura do problema (caminho/código), nunca o texto do modelo.
    const issues = [...(content.error?.issues ?? []), ...(settings.error?.issues ?? [])].slice(0, 3);
    console.warn("[templates] conteúdo recusado", issues.map((i) => `${i.path.join(".")}:${i.code}`));
    return { ok: false, error: "O conteúdo do modelo contém elementos não suportados." };
  }

  const usedVariables = extractVariables(content.data);
  const allowed = knownKeys(await listFields(userId));
  const unknown = usedVariables.filter((key) => !["logo", "assinatura"].includes(key) && !allowed.has(key));
  if (unknown.length) return { ok: false, error: `Variáveis desconhecidas: ${unknown.join(", ")}` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipt_templates")
    .update({ content: content.data, settings: settings.data, used_variables: usedVariables })
    .eq("id", input.id)
    .eq("user_id", userId)
    .eq("revision", input.revision)
    .select("revision");
  if (error) return { ok: false, error: "Não foi possível salvar. Verifique sua conexão." };
  if (!data || data.length === 0) return { ok: false, conflict: true };

  // Sem revalidatePath: recarregar a página reiniciaria o editor em uso.
  return { ok: true, revision: data[0].revision as number, usedVariables };
}
