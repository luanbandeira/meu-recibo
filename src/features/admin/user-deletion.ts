import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Exclusão definitiva (LGPD), na ordem que não deixa sobras:
//   1. arquivos do Storage (logo, assinatura, PDFs) — não caem em cascata;
//   2. confere que não sobrou nenhum; se sobrou, PARA (a conta continua e
//      dá para tentar de novo, sem arquivos órfãos de uma conta inexistente);
//   3. contadores de tentativas ligados ao usuário;
//   4. a conta — o banco apaga em cascata perfil, modelos, campos, recibos,
//      versões e sessões de suporte, e anonimiza a auditoria.

export type DeletionResult =
  | { ok: true; receipts: number; files: number }
  | { ok: false; stage: "files" | "account"; error: string };

const REMOVE_BATCH = 100;

type StorageObject = { bucket_id: string; name: string };

async function listFiles(admin: SupabaseClient, userId: string): Promise<StorageObject[] | null> {
  const { data, error } = await admin.rpc("admin_user_storage_objects", { p_user_id: userId });
  return error ? null : ((data ?? []) as StorageObject[]);
}

export async function deleteUserCompletely(admin: SupabaseClient, userId: string): Promise<DeletionResult> {
  const filesFailed = {
    ok: false as const,
    stage: "files" as const,
    error: "Não foi possível apagar todos os arquivos do usuário. Nada foi excluído — tente de novo.",
  };

  const { count: receipts } = await admin
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const files = await listFiles(admin, userId);
  if (!files) return filesFailed;

  const byBucket = new Map<string, string[]>();
  for (const file of files) byBucket.set(file.bucket_id, [...(byBucket.get(file.bucket_id) ?? []), file.name]);
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += REMOVE_BATCH) {
      const { error } = await admin.storage.from(bucket).remove(names.slice(i, i + REMOVE_BATCH));
      if (error) return filesFailed;
    }
  }

  const remaining = await listFiles(admin, userId);
  if (!remaining || remaining.length > 0) return filesFailed;

  await admin.rpc("admin_forget_rate_limits", { p_user_id: userId });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return {
      ok: false,
      stage: "account",
      error: "Os arquivos foram apagados, mas a conta não pôde ser excluída. Tente de novo.",
    };
  }
  return { ok: true, receipts: receipts ?? 0, files: files.length };
}
