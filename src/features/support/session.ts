import "server-only";
import { cache } from "react";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export type SupportSession = {
  id: string;
  targetUserId: string;
  targetName: string;
  targetUsername: string;
  reason: string | null;
  expiresAt: string;
};

/**
 * Sessão de suporte aberta e não expirada do super admin logado. A linha no
 * banco É o estado do modo suporte: sem cookie, sem id vindo do navegador. A
 * RLS usa a mesma sessão (private.support_target_id) para liberar leitura.
 */
export const getActiveSupportSession = cache(async (): Promise<SupportSession | null> => {
  const session = await getSession();
  if (!session || session.profile.role !== "super_admin" || session.profile.status !== "active") return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("support_sessions")
    .select(
      `id, target_user_id, reason, expires_at,
       target:profiles!support_sessions_target_user_id_fkey(display_name, username)`,
    )
    .eq("admin_id", session.userId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{
      id: string;
      target_user_id: string;
      reason: string | null;
      expires_at: string;
      target: { display_name: string; username: string } | null;
    }>();
  if (!data) return null;

  // Nome profissional do alvo (a RLS libera durante a sessão).
  const { data: professional } = await supabase
    .from("professional_profiles")
    .select("full_name")
    .eq("user_id", data.target_user_id)
    .maybeSingle();

  return {
    id: data.id,
    targetUserId: data.target_user_id,
    targetName: professional?.full_name ?? data.target?.display_name ?? "Usuário",
    targetUsername: data.target?.username ?? "",
    reason: data.reason,
    expiresAt: data.expires_at,
  };
});
