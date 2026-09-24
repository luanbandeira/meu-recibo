import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accounts, login } from "./helpers";

// Exclusão definitiva (LGPD) pela tela do admin, com uma conta própria deste
// teste (as contas compartilhadas continuam para os outros arquivos).

test("admin desativa e exclui definitivamente um usuário, sem sobrar nada", async ({ page }) => {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const username = `e2e-pwdel-${randomBytes(4).toString("hex")}`;
  const { data, error } = await service.auth.admin.createUser({
    email: `${username}@${process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN}`,
    password: `E2e-${randomUUID()}`,
    email_confirm: true,
    app_metadata: { username, display_name: "Pessoa Para Excluir", role: "user" },
  });
  if (error || !data.user) throw error;
  const id = data.user.id;

  try {
    await service.storage.from("logos").upload(`${id}/${randomUUID()}.png`, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { contentType: "image/png" });

    await login(page, accounts().admin);
    await page.goto(`/admin/usuarios/${id}`);

    // Conta ativa: a exclusão exige desativar antes.
    await expect(page.getByText("Para excluir, desative o usuário primeiro.")).toBeVisible();
    await page.getByRole("button", { name: "Desativar usuário" }).click();
    await page.getByRole("button", { name: "Desativar", exact: true }).click();
    await expect(page.getByText("Usuário desativado.")).toBeVisible();

    await page.getByRole("button", { name: "Excluir definitivamente…" }).click();
    await expect(page.getByText("1 arquivo guardado")).toBeVisible();
    const confirm = page.getByRole("button", { name: /para sempre/ });
    await expect(confirm).toBeDisabled();
    await page.getByLabel(/digite o nome de usuário/).fill(username);
    await confirm.click();

    await expect(page).toHaveURL(/\/admin\/usuarios\?excluido=1$/);
    await expect(page.getByText("Usuário excluído definitivamente")).toBeVisible();

    const files = await service.rpc("admin_user_storage_objects", { p_user_id: id });
    expect(files.data).toEqual([]);
    expect((await service.auth.admin.getUserById(id)).data.user).toBeNull();

    await page.goto("/admin/auditoria?acao=usuarios");
    await expect(page.getByText(/excluiu definitivamente um usuário/).first()).toBeVisible();
    await expect(page.getByText(/Apagados: 0 recibos e 1 arquivo/).first()).toBeVisible();
  } finally {
    // Se algo falhou no meio, não deixa a conta para trás.
    const { data: left } = await service.rpc("admin_user_storage_objects", { p_user_id: id });
    for (const file of (left ?? []) as { bucket_id: string; name: string }[]) await service.storage.from(file.bucket_id).remove([file.name]);
    await service.auth.admin.deleteUser(id).catch(() => undefined);
  }
});
