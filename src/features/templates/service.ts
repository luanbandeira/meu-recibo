import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEMPLATE_SETTINGS, templatePreset } from "./document/default-template";
import { extractVariables } from "./document/variables";

// Fora de "use server": não é chamável pelo navegador.

/** Cria o primeiro modelo (o escolhido na configuração inicial) se o usuário ainda não tiver nenhum. */
export async function ensureDefaultTemplate(userId: string, presetKey?: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("receipt_templates")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (count) return;
  const preset = templatePreset(presetKey);
  await supabase.from("receipt_templates").insert({
    user_id: userId,
    name: preset.name,
    content: preset.content,
    settings: DEFAULT_TEMPLATE_SETTINGS,
    used_variables: extractVariables(preset.content),
    is_default: true,
  });
}
