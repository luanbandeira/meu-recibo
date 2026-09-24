import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus } from "@/features/auth/session";

// Todas as consultas usam a sessão do admin: as RPCs verificam super admin no
// banco e a RLS de audit_logs só libera leitura para super admin.

export type AdminUserRow = {
  id: string;
  username: string;
  display_name: string;
  full_name: string | null;
  status: AccountStatus;
  must_change_password: boolean;
  onboarding_completed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export type AdminUserDetail = AdminUserRow & { created_by_name: string | null };

export type UserStats = {
  total: number;
  active: number;
  disabled: number;
  pending_first_access: number;
};

export type AuditEntry = {
  id: number;
  action: string;
  created_at: string;
  actor: { display_name: string } | null;
  target: { display_name: string; username: string } | null;
};

export const USERS_PAGE_SIZE = 20;

export async function listUsers(params: {
  search?: string;
  status?: AccountStatus;
  page?: number;
}): Promise<{ users: AdminUserRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: params.search?.trim() || null,
    p_status: params.status ?? null,
    p_limit: USERS_PAGE_SIZE,
    p_offset: (page - 1) * USERS_PAGE_SIZE,
  });
  if (error) throw new Error(`admin_list_users: ${error.code}`);

  const rows = (data ?? []) as (AdminUserRow & { total_count: number })[];
  return { users: rows, total: Number(rows[0]?.total_count ?? 0) };
}

export async function getUser(userId: string): Promise<AdminUserDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_user", { p_user_id: userId });
  if (error) throw new Error(`admin_get_user: ${error.code}`);
  return ((data ?? []) as AdminUserDetail[])[0] ?? null;
}

export async function getUserStats(): Promise<UserStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_stats");
  if (error) throw new Error(`admin_user_stats: ${error.code}`);
  return data as UserStats;
}

export async function listAuditEntries(params: { targetUserId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select(
      `id, action, created_at,
       actor:profiles!audit_logs_actor_id_fkey(display_name),
       target:profiles!audit_logs_target_user_id_fkey(display_name, username)`,
    )
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 10);
  if (params.targetUserId) query = query.eq("target_user_id", params.targetUserId);

  const { data, error } = await query;
  if (error) throw new Error(`audit_logs: ${error.code}`);
  return (data ?? []) as unknown as AuditEntry[];
}

export type AuditRow = {
  id: number;
  action: string;
  created_at: string;
  actor_name: string | null;
  target_user_id: string | null;
  target_name: string | null;
  target_username: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  support_reason: string | null;
};

/** Tela de auditoria: filtros e paginação no banco (RPC só para super admin). */
export async function searchAudit(params: {
  actionPrefix: string | null;
  targetUserId: string | null;
  from: string | null;
  offset: number;
  limit: number;
}): Promise<{ rows: AuditRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_audit", {
    p_action_prefix: params.actionPrefix,
    p_target_user_id: params.targetUserId,
    p_from: params.from,
    p_to: null,
    p_limit: params.limit,
    p_offset: params.offset,
  });
  if (error) throw new Error(`admin_list_audit: ${error.code}`);
  const rows = (data ?? []) as (AuditRow & { total_count: number })[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}
