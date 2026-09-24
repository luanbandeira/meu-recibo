import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Cliente com a secret key: IGNORA a RLS.
 * Use somente em ações administrativas já autorizadas no servidor
 * (ex.: requireSuperAdmin()) e nas poucas operações que o usuário não pode
 * fazer sozinho (ex.: baixar a flag de troca de senha).
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Variável de ambiente ausente: SUPABASE_SECRET_KEY.");
  }
  return createClient(publicEnv.supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
