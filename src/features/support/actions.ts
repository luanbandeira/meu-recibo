"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/features/admin/queries";
import { requireSuperAdmin } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SUPPORT_REASON_MAX, SUPPORT_REASON_MIN } from "./limits";
import { getActiveSupportSession } from "./session";

export type StartSupportState = { error?: string };

/**
 * Abre o modo suporte (somente leitura, 30 min). A RPC verifica super admin,
 * fecha uma sessão anterior e grava a auditoria na mesma transação.
 */
export async function startSupport(_prev: StartSupportState, formData: FormData): Promise<StartSupportState> {
  await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!z.uuid().safeParse(userId).success) return { error: "Usuário inválido." };
  if (reason.length < SUPPORT_REASON_MIN) return { error: "Descreva o motivo do acesso (ex.: “ajuda com o modelo”)." };
  if (reason.length > SUPPORT_REASON_MAX) return { error: `Use no máximo ${SUPPORT_REASON_MAX} caracteres.` };

  const user = await getUser(userId);
  if (!user) return { error: "Usuário não encontrado." };
  if (!user.onboarding_completed) return { error: "Este usuário ainda não concluiu a configuração inicial — não há ambiente para visualizar." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_support_session", { p_target_user_id: userId, p_reason: reason });
  if (error) return { error: "Não foi possível abrir o modo de suporte. Tente novamente." };

  redirect("/dashboard");
}

/** Encerra o modo suporte e volta à ficha do usuário atendido. */
export async function endSupport(): Promise<void> {
  await requireSuperAdmin();
  const active = await getActiveSupportSession();
  const supabase = await createClient();
  await supabase.rpc("end_support_session");
  redirect(active ? `/admin/usuarios/${active.targetUserId}?suporte=encerrado` : "/admin");
}
