import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { purgeTestAuditLogs } from "../integration/helpers";
import { clearState, readState } from "./state";

// Apaga tudo o que a execução criou: arquivos (inclusive PDFs em subpastas),
// registros de auditoria e as contas.
export default async function globalTeardown() {
  const state = readState();
  if (!state) return;
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ids = [state.user.id, state.admin.id];
  for (const id of ids) {
    for (const bucket of ["logos", "signatures", "receipts"]) {
      const walk = async (prefix: string): Promise<string[]> => {
        const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        const paths: string[] = [];
        for (const item of data ?? []) {
          if (item.id) paths.push(`${prefix}/${item.name}`);
          else paths.push(...(await walk(`${prefix}/${item.name}`)));
        }
        return paths;
      };
      const paths = await walk(id);
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    }
  }
  await purgeTestAuditLogs(ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  clearState();
}
