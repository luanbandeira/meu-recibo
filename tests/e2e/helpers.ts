import { expect, type Page } from "@playwright/test";
import { readState, type E2EAccount } from "./state";

export function accounts() {
  const state = readState();
  if (!state) throw new Error("Contas de teste não criadas (global-setup).");
  return state;
}

export async function login(page: Page, account: E2EAccount) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(account.username);
  await page.getByLabel("Senha", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Coleta avisos de bloqueio da CSP durante o teste (devem ser zero). */
export function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  return violations;
}
