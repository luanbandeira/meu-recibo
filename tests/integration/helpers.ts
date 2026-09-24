import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const emailDomain = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN;

export const hasSupabaseEnv = Boolean(url && publishableKey && secretKey && emailDomain);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient {
  return createClient(url!, secretKey!, noSession);
}

export function anonClient(): SupabaseClient {
  return createClient(url!, publishableKey!, noSession);
}

export type TestUser = { id: string; username: string; password: string; client: SupabaseClient };

/**
 * Cria um usuário fictício pela Admin API e devolve um cliente já autenticado.
 * O id entra em `track` logo após a criação: se algo falhar depois, a limpeza
 * do teste ainda remove a conta (nada vaza para o banco de desenvolvimento).
 */
export async function createTestUser(
  admin: SupabaseClient,
  label: string,
  track: string[],
  role: "user" | "super_admin" = "user",
): Promise<TestUser> {
  const username = `teste-${label}-${randomUUID().slice(0, 8)}`;
  const password = `Teste-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${emailDomain}`,
    password,
    email_confirm: true,
    app_metadata: { username, display_name: `Teste ${label.toUpperCase()}`, role },
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  track.push(data.user.id);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email: `${username}@${emailDomain}`,
    password,
  });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);

  return { id: data.user.id, username, password, client };
}

/**
 * Remove as linhas de auditoria geradas pelos usuários de teste, para não
 * poluir o histórico real do ambiente de desenvolvimento. audit_logs é
 * append-only; só esta limpeza de teste desliga o gatilho, numa transação,
 * usando a conexão direta (SUPABASE_DB_URL).
 */
export async function purgeTestAuditLogs(userIds: string[]) {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl || userIds.length === 0) return;
  const { Client } = await import("pg");
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("alter table public.audit_logs disable trigger audit_logs_no_update");
    await client.query(
      "delete from public.audit_logs where actor_id = any($1::uuid[]) or target_user_id = any($1::uuid[])",
      [userIds],
    );
    await client.query("alter table public.audit_logs enable trigger audit_logs_no_update");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
export const TINY_PDF = new Blob(["%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"], {
  type: "application/pdf",
});
