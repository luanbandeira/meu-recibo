"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedUser } from "@/features/profile/guards";
import type { FieldDefinition } from "@/features/templates/document/variables";
import { createClient } from "@/lib/supabase/server";
import { FIELD_COLUMNS } from "./queries";
import { createFieldSchema, normalizeDefault, updateFieldSchema } from "./schema";

type Errors = Partial<Record<"label" | "key" | "type" | "defaultValue", string>>;
export type FieldActionResult = { ok: true; field: FieldDefinition } | { ok: false; errors?: Errors; error?: string };

export async function createField(input: z.input<typeof createFieldSchema>): Promise<FieldActionResult> {
  const { userId } = await requireOnboardedUser();
  const parsed = createFieldSchema.safeParse(input);
  if (!parsed.success) {
    const e = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, errors: { label: e.label?.[0], key: e.key?.[0], type: e.type?.[0], defaultValue: e.defaultValue?.[0] } };
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("fields")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("fields")
    .insert({
      user_id: userId,
      key: parsed.data.key,
      label: parsed.data.label,
      type: parsed.data.type,
      required: parsed.data.required,
      default_value: parsed.data.defaultValue,
      sort_order: (last?.sort_order ?? 0) + 10,
    })
    .select(FIELD_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, errors: { key: "Você já tem um campo com este identificador." } };
    return { ok: false, error: "Não foi possível criar o campo." };
  }
  revalidatePath("/modelos", "layout");
  return { ok: true, field: data as FieldDefinition };
}

export async function updateField(input: z.input<typeof updateFieldSchema>): Promise<FieldActionResult> {
  const { userId } = await requireOnboardedUser();
  const parsed = updateFieldSchema.safeParse(input);
  if (!parsed.success) {
    const e = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, errors: { label: e.label?.[0], defaultValue: e.defaultValue?.[0] } };
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from("fields").select("type").eq("id", parsed.data.id).maybeSingle();
  if (!current) return { ok: false, error: "Campo não encontrado." };

  const { data, error } = await supabase
    .from("fields")
    .update({
      label: parsed.data.label,
      required: parsed.data.required,
      default_value: normalizeDefault(current.type, parsed.data.defaultValue),
    })
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .select(FIELD_COLUMNS)
    .single();
  if (error) return { ok: false, error: "Não foi possível salvar o campo." };

  revalidatePath("/modelos", "layout");
  return { ok: true, field: data as FieldDefinition };
}

export async function setFieldArchived(id: string, archived: boolean): Promise<{ ok: boolean }> {
  const { userId } = await requireOnboardedUser();
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("fields")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/modelos", "layout");
  return { ok: !error };
}
