/**
 * Exclusão definitiva (LGPD) contra o projeto Supabase de DESENVOLVIMENTO:
 * depois dela não sobra conta, dado nem arquivo — em nenhuma pasta.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EMPTY_DOC, TINY_PDF, adminClient, createTestUser, hasSupabaseEnv, purgeTestAuditLogs, type TestUser } from "./helpers";

vi.mock("server-only", () => ({}));
const { deleteUserCompletely } = await import("@/features/admin/user-deletion");

const PNG = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" });

describe.skipIf(!hasSupabaseEnv)("Exclusão definitiva de usuário (LGPD)", () => {
  const created: string[] = [];
  let admin: SupabaseClient;
  let user: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    admin = adminClient();
    user = await createTestUser(admin, "a", created);
    other = await createTestUser(admin, "b", created);

    // Dados e arquivos em várias pastas, como no uso real.
    await user.client.from("professional_profiles").insert({ user_id: user.id, full_name: "Pessoa Fictícia" });
    const { data: template } = await user.client
      .from("receipt_templates")
      .insert({ user_id: user.id, name: "Modelo", content: EMPTY_DOC })
      .select("id")
      .single();
    const { data: issued, error } = await user.client.rpc("issue_receipt", {
      p_template_id: template!.id,
      p_values: { valor: 100 },
      p_summary: { payer_name: "Pagador Fictício", amount_cents: 100 },
      p_idempotency_key: randomUUID(),
    });
    if (error) throw error;
    await user.client.storage.from("receipts").upload(`${user.id}/${issued.receipt_id}/v1.pdf`, TINY_PDF, { contentType: "application/pdf" });
    await user.client.storage.from("logos").upload(`${user.id}/${randomUUID()}.png`, PNG, { contentType: "image/png" });
    await user.client.storage.from("signatures").upload(`${user.id}/${randomUUID()}.png`, PNG, { contentType: "image/png" });
    await other.client.storage.from("logos").upload(`${other.id}/${randomUUID()}.png`, PNG, { contentType: "image/png" });
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of created) {
      const { data } = await admin.rpc("admin_user_storage_objects", { p_user_id: id });
      for (const file of (data ?? []) as { bucket_id: string; name: string }[]) {
        await admin.storage.from(file.bucket_id).remove([file.name]);
      }
    }
    await purgeTestAuditLogs(created);
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  it("apaga conta, dados e todos os arquivos — e só os dessa pessoa", async () => {
    const before = await admin.rpc("admin_user_storage_objects", { p_user_id: user.id });
    expect(before.data).toHaveLength(3);

    const result = await deleteUserCompletely(admin, user.id);
    expect(result).toEqual({ ok: true, receipts: 1, files: 3 });

    const after = await admin.rpc("admin_user_storage_objects", { p_user_id: user.id });
    expect(after.data).toEqual([]);
    expect((await admin.auth.admin.getUserById(user.id)).data.user).toBeNull();
    for (const table of ["profiles", "professional_profiles", "receipt_templates", "receipts", "receipt_versions", "fields"]) {
      const column = table === "profiles" ? "id" : "user_id";
      const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, user.id);
      expect(count, table).toBe(0);
    }

    // A outra pessoa não perdeu nada.
    const others = await admin.rpc("admin_user_storage_objects", { p_user_id: other.id });
    expect(others.data).toHaveLength(1);
  });

  it("usuário comum não lista arquivos de ninguém", async () => {
    const { error } = await other.client.rpc("admin_user_storage_objects", { p_user_id: other.id });
    expect(error).not.toBeNull();
  });
});
