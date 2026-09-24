import "server-only";
import { cache } from "react";
import type { FieldDefinition } from "@/features/templates/document/variables";
import { createClient } from "@/lib/supabase/server";

export const FIELD_COLUMNS = "id, key, label, type, required, default_value, is_system, sort_order, archived_at";

/** Campos do usuário (padrão + personalizados, inclusive arquivados). RLS: só os próprios. */
export const listFields = cache(async (userId: string): Promise<FieldDefinition[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fields")
    .select(FIELD_COLUMNS)
    .eq("user_id", userId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(`fields: ${error.code}`);
  return (data ?? []) as FieldDefinition[];
});
