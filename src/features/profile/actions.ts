"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { professionalProfileSchema, toProfileRow } from "./schema";
import { getProfessionalProfile } from "./queries";

type ProfileField = keyof z.input<typeof professionalProfileSchema>;

export type SaveProfileState = {
  fieldErrors?: Partial<Record<ProfileField, string>>;
  formError?: string;
  savedAt?: number;
};

export async function saveProfessionalProfile(
  _prev: SaveProfileState,
  formData: FormData,
): Promise<SaveProfileState> {
  const { userId } = await requireUser();

  const input = Object.fromEntries(
    ["fullName", "companyName", "profession", "council", "registrationNumber", "document", "phone", "city", "state"].map(
      (key) => [key, String(formData.get(key) ?? "")],
    ),
  );
  const parsed = professionalProfileSchema.safeParse(input);
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: Object.fromEntries(Object.entries(errors).map(([key, messages]) => [key, messages?.[0]])),
    };
  }

  // RLS: insert/update só na própria linha.
  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_profiles")
    .upsert({ user_id: userId, ...toProfileRow(parsed.data) }, { onConflict: "user_id" });
  if (error) return { formError: "Não foi possível salvar seus dados. Tente novamente." };

  revalidatePath("/", "layout");
  if (formData.get("intent") === "onboarding") redirect("/onboarding?etapa=2");
  return { savedAt: Date.now() };
}

export async function completeOnboarding() {
  const { userId } = await requireUser();
  const profile = await getProfessionalProfile(userId);
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("onboarding_completed_at", null);
  if (error) throw new Error("Não foi possível concluir a configuração.");

  revalidatePath("/", "layout");
  redirect("/dashboard?bem-vindo=1");
}

export async function removeLogo(): Promise<{ ok: boolean }> {
  const { userId } = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("professional_profiles").update({ logo_asset_id: null }).eq("user_id", userId);
  revalidatePath("/", "layout");
  return { ok: !error };
}
