import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TemplateSettings } from "./document/constants";
import type { TemplateContent } from "./document/schema";

export type TemplateSummary = {
  id: string;
  name: string;
  status: "active" | "archived";
  is_default: boolean;
  used_variables: string[];
  updated_at: string;
};

export type Template = TemplateSummary & {
  content: TemplateContent;
  settings: TemplateSettings;
  revision: number;
};

export async function listTemplates(userId: string, status: "active" | "archived" = "active") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipt_templates")
    .select("id, name, status, is_default, used_variables, updated_at")
    .eq("user_id", userId)
    .eq("status", status)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`receipt_templates: ${error.code}`);
  return (data ?? []) as TemplateSummary[];
}

export async function getTemplate(userId: string, id: string): Promise<Template | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipt_templates")
    .select("id, name, status, is_default, used_variables, updated_at, content, settings, revision")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`receipt_templates: ${error.code}`);
  return data as Template | null;
}
