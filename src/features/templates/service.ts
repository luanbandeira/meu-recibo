import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_TEMPLATE_CONTENT,
  DEFAULT_TEMPLATE_NAME,
  DEFAULT_TEMPLATE_SETTINGS,
} from "./document/default-template";
import { extractVariables } from "./document/variables";

// Fora de "use server": não é chamável pelo navegador.

/** Cria o "Recibo padrão" se o usuário ainda não tiver nenhum modelo. */
export async function ensureDefaultTemplate(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("receipt_templates")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (count) return;
  await supabase.from("receipt_templates").insert({
    user_id: userId,
    name: DEFAULT_TEMPLATE_NAME,
    content: DEFAULT_TEMPLATE_CONTENT,
    settings: DEFAULT_TEMPLATE_SETTINGS,
    used_variables: extractVariables(DEFAULT_TEMPLATE_CONTENT),
    is_default: true,
  });
}
