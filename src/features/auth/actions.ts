"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newPasswordSchema } from "./password";
import { getSession, homePathFor, requirePendingPasswordChange } from "./session";

export type ChangePasswordState = {
  fieldErrors?: { password?: string; confirmPassword?: string };
  formError?: string;
};

export async function changeTemporaryPassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await requirePendingPasswordChange();

  const parsed = newPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: {
        password: errors.password?.[0],
        confirmPassword: errors.confirmPassword?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { fieldErrors: { password: "A nova senha precisa ser diferente da temporária." } };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: "Senha muito fraca. Use letras e números." } };
    }
    return { formError: "Não foi possível salvar a nova senha. Tente novamente." };
  }

  // A senha já foi trocada com a sessão do próprio usuário; só então a flag é
  // baixada (o usuário não tem permissão de UPDATE em profiles).
  const { error: flagError } = await createAdminClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", session.userId);
  if (flagError) {
    return { formError: "Senha alterada, mas não foi possível concluir. Tente entrar novamente." };
  }

  redirect(homePathFor({ ...session.profile, must_change_password: false }));
}

export async function signOut() {
  const supabase = await createClient();
  // Admin saindo com modo suporte aberto: encerra (e audita) antes de sair.
  const session = await getSession();
  if (session?.profile.role === "super_admin") await supabase.rpc("end_support_session");
  await supabase.auth.signOut();
  redirect("/login");
}
