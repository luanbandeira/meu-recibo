"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/features/audit/log";
import { generateTemporaryPassword } from "@/features/auth/password";
import { requireSuperAdmin } from "@/features/auth/session";
import { usernameToAuthEmail } from "@/features/auth/username";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserSchema, userIdSchema } from "./schemas";
import { RATE_LIMIT_MESSAGE, withinRateLimit } from "@/lib/security/rate-limit";

// Toda ação: (1) autoriza super admin no servidor, (2) valida entrada,
// (3) executa com a secret key, (4) registra auditoria sem dados sensíveis.
// Senhas temporárias voltam UMA vez para a tela e nunca são gravadas/logadas.

// Banimento "permanente" do Supabase Auth (até ser removido na reativação).
const BAN_FOREVER = "876000h";

export type IssuedCredentials = {
  userId: string;
  username: string;
  displayName: string;
  temporaryPassword: string;
};

export type CreateUserState = {
  fieldErrors?: { displayName?: string; username?: string };
  formError?: string;
  created?: IssuedCredentials;
};

export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const { userId: adminId } = await requireSuperAdmin();
  if (!(await withinRateLimit("adminUserAction", adminId))) return { formError: RATE_LIMIT_MESSAGE };

  const parsed = createUserSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    username: String(formData.get("username") ?? ""),
  });
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return { fieldErrors: { displayName: errors.displayName?.[0], username: errors.username?.[0] } };
  }
  const { displayName, username } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) {
    return { fieldErrors: { username: "Este usuário já existe. Escolha outro." } };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToAuthEmail(username, publicEnv.authEmailDomain),
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { username, display_name: displayName, role: "user", created_by: adminId },
  });

  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.code === "user_already_exists") {
      return { fieldErrors: { username: "Este usuário já existe. Escolha outro." } };
    }
    return { formError: "Não foi possível criar o usuário. Tente novamente." };
  }

  await writeAuditLog({
    actorId: adminId,
    action: "admin.user.create",
    targetUserId: data.user.id,
    entityType: "user",
    entityId: data.user.id,
    metadata: { username },
  });

  revalidatePath("/admin", "layout");
  return { created: { userId: data.user.id, username, displayName, temporaryPassword } };
}

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Busca o alvo garantindo que é um usuário comum (admins não são geridos aqui). */
async function findManagedUser(userId: string) {
  if (!userIdSchema.safeParse(userId).success) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, username, display_name, status")
    .eq("id", userId)
    .eq("role", "user")
    .maybeSingle();
  return data;
}

export async function resetAccess(userId: string): Promise<ActionResult<{ credentials: IssuedCredentials }>> {
  const { userId: adminId } = await requireSuperAdmin();
  if (!(await withinRateLimit("adminUserAction", adminId))) return { ok: false, error: RATE_LIMIT_MESSAGE };
  const target = await findManagedUser(userId);
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  if (target.status !== "active") {
    return { ok: false, error: "Reative o usuário antes de redefinir o acesso." };
  }

  const admin = createAdminClient();
  const temporaryPassword = generateTemporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(target.id, { password: temporaryPassword });
  if (error) return { ok: false, error: "Não foi possível redefinir o acesso. Tente novamente." };

  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", target.id);
  // Derruba sessões abertas em qualquer aparelho.
  await admin.rpc("admin_revoke_sessions", { p_user_id: target.id });
  if (flagError) return { ok: false, error: "Senha alterada, mas não foi possível concluir. Tente novamente." };

  await writeAuditLog({
    actorId: adminId,
    action: "admin.user.reset_access",
    targetUserId: target.id,
    entityType: "user",
    entityId: target.id,
  });

  revalidatePath("/admin", "layout");
  return {
    ok: true,
    credentials: {
      userId: target.id,
      username: target.username,
      displayName: target.display_name,
      temporaryPassword,
    },
  };
}

export async function setUserStatus(userId: string, status: "active" | "disabled"): Promise<ActionResult> {
  const { userId: adminId } = await requireSuperAdmin();
  if (!(await withinRateLimit("adminUserAction", adminId))) return { ok: false, error: RATE_LIMIT_MESSAGE };
  const target = await findManagedUser(userId);
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  if (target.status === status) return { ok: true };

  const admin = createAdminClient();
  const disabling = status === "disabled";

  // Bloqueia/libera o login no Auth antes de mudar o status no banco.
  const { error: banError } = await admin.auth.admin.updateUserById(target.id, {
    ban_duration: disabling ? BAN_FOREVER : "none",
  });
  if (banError) return { ok: false, error: "Não foi possível alterar a situação. Tente novamente." };

  const { error } = await admin.from("profiles").update({ status }).eq("id", target.id);
  if (error) return { ok: false, error: "Não foi possível alterar a situação. Tente novamente." };

  if (disabling) await admin.rpc("admin_revoke_sessions", { p_user_id: target.id });

  await writeAuditLog({
    actorId: adminId,
    action: disabling ? "admin.user.disable" : "admin.user.enable",
    targetUserId: target.id,
    entityType: "user",
    entityId: target.id,
  });

  revalidatePath("/admin", "layout");
  return { ok: true };
}
