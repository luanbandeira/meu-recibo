import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { deleteUserCompletely } = await import("@/features/admin/user-deletion");

const USER = "00000000-0000-4000-8000-00000000000b";

/** Cliente falso: registra a ordem das chamadas e simula o Storage. */
function fakeAdmin(options: { files: { bucket_id: string; name: string }[]; removeFails?: boolean; filesStay?: boolean; deleteFails?: boolean }) {
  const calls: string[] = [];
  let files = [...options.files];
  const client = {
    from: () => ({
      select: () => ({ eq: async () => ({ count: 3 }) }),
    }),
    rpc: async (name: string) => {
      calls.push(name);
      if (name === "admin_user_storage_objects") return { data: files, error: null };
      return { data: 2, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (names: string[]) => {
          calls.push(`remove ${bucket} ${names.length}`);
          if (options.removeFails) return { error: { message: "falhou" } };
          if (!options.filesStay) files = files.filter((f) => !(f.bucket_id === bucket && names.includes(f.name)));
          return { error: null };
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          calls.push(`deleteUser ${id}`);
          return { error: options.deleteFails ? { message: "falhou" } : null };
        },
      },
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const someFiles = [
  { bucket_id: "logos", name: `${USER}/a.png` },
  { bucket_id: "receipts", name: `${USER}/r1/v1.pdf` },
  ...Array.from({ length: 150 }, (_, i) => ({ bucket_id: "receipts", name: `${USER}/r${i}/v2.pdf` })),
];

describe("exclusão definitiva de usuário (LGPD)", () => {
  it("apaga os arquivos (em lotes), confere, esquece os contadores e só então exclui a conta", async () => {
    const { client, calls } = fakeAdmin({ files: someFiles });
    const result = await deleteUserCompletely(client, USER);
    expect(result).toEqual({ ok: true, receipts: 3, files: 152 });
    expect(calls).toEqual([
      "admin_user_storage_objects",
      "remove logos 1",
      "remove receipts 100",
      "remove receipts 51",
      "admin_user_storage_objects",
      "admin_forget_rate_limits",
      `deleteUser ${USER}`,
    ]);
  });

  it("se o Storage recusar, para antes de excluir a conta", async () => {
    const { client, calls } = fakeAdmin({ files: someFiles, removeFails: true });
    const result = await deleteUserCompletely(client, USER);
    expect(result).toMatchObject({ ok: false, stage: "files" });
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("se sobrar algum arquivo, para antes de excluir a conta", async () => {
    const { client, calls } = fakeAdmin({ files: someFiles, filesStay: true });
    const result = await deleteUserCompletely(client, USER);
    expect(result).toMatchObject({ ok: false, stage: "files" });
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("usuário sem arquivos: exclui direto", async () => {
    const { client, calls } = fakeAdmin({ files: [] });
    expect(await deleteUserCompletely(client, USER)).toEqual({ ok: true, receipts: 3, files: 0 });
    expect(calls.filter((c) => c.startsWith("remove"))).toEqual([]);
  });

  it("informa quando os arquivos saíram mas a conta não", async () => {
    const { client } = fakeAdmin({ files: someFiles, deleteFails: true });
    expect(await deleteUserCompletely(client, USER)).toMatchObject({ ok: false, stage: "account" });
  });
});
