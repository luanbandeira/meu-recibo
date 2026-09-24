import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditAction } from "./labels";

type AuditEntry = {
  actorId: string;
  action: AuditAction;
  targetUserId?: string;
  entityType?: string;
  entityId?: string;
  /** Nunca incluir senha, CPF, dados de paciente ou outros dados pessoais. */
  metadata?: Record<string, string | number | boolean | null>;
};

/**
 * Registra ação administrativa. É chamada depois que a ação deu certo; se a
 * gravação falhar, a ação não é desfeita (o Auth não tem transação com o
 * banco), mas a falha fica no log do servidor — sem dados pessoais.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const { error } = await createAdminClient()
    .from("audit_logs")
    .insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    });

  if (error) {
    console.error("[audit] falha ao registrar", { action: entry.action, code: error.code });
  }
}
