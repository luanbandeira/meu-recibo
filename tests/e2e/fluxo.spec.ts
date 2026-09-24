import { expect, test } from "@playwright/test";
import { accounts, login, watchCsp } from "./helpers";

// Fluxo principal no celular (375 px): emitir → histórico → corrigir →
// modo suporte do admin → auditoria. Em série: cada passo usa o anterior.
test.describe.configure({ mode: "serial" });

const PAYER = "Carlos Exemplo Automatizado";

test("emite um recibo do início ao PDF", async ({ page }) => {
  const csp = watchCsp(page);
  const { user } = accounts();
  await login(page, user);
  await expect(page.getByRole("heading", { name: /Olá, Beatriz/ })).toBeVisible();

  await page.getByRole("link", { name: /Emitir recibo/ }).first().click();
  await page.getByRole("link", { name: /Recibo padrão/ }).click();

  await page.getByLabel("Nome do pagador").fill(PAYER);
  await page.getByLabel("Valor").fill("35000");
  await expect(page.getByLabel("Valor")).toHaveValue("R$ 350,00");
  await page.getByLabel("Nome do paciente").fill("Paciente Fictício");
  await page.getByLabel("Data do procedimento").fill("2026-09-20");
  await page.getByRole("button", { name: "Visualizar recibo" }).click();

  // A prévia é o PDF real, desenhado pelo pdf.js.
  await expect(page).toHaveURL(/\/previa$/);
  await expect(page.locator("main canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Gerar PDF" }).click();

  await expect(page).toHaveURL(/\/recibos\/[0-9a-f-]+\?novo=1$/);
  await expect(page.getByText(/Recibo REC-\d{4}-\d{6} emitido e salvo/)).toBeVisible();
  await expect(page.locator("main canvas").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toBeVisible();
  expect(csp).toEqual([]);
});

test("encontra no histórico e corrige (versão 2)", async ({ page }) => {
  const { user } = accounts();
  await login(page, user);
  await page.goto("/recibos");
  await page.getByLabel("Buscar").fill("carlos automatizado");
  await expect(page).toHaveURL(/q=carlos/);
  await expect(page.getByText("1 recibo encontrado")).toBeVisible();

  await page.getByRole("link", { name: new RegExp(PAYER) }).click();
  await page.getByRole("link", { name: "Corrigir" }).click();
  await expect(page.getByLabel("Valor")).toHaveValue("R$ 350,00");
  await page.getByLabel("Valor").fill("38000");
  await page.getByRole("button", { name: "Visualizar recibo" }).click();

  await expect(page.locator("main canvas").first()).toBeVisible();
  await page.getByLabel(/O que foi corrigido/).fill("Valor ajustado");
  await page.getByRole("button", { name: "Salvar versão 2" }).click();

  await expect(page.getByText(/Correção salva: versão 2/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Versões" })).toBeVisible();
  await expect(page.getByText("“Valor ajustado”")).toBeVisible();
  await expect(page.getByText("R$ 380,00")).toBeVisible();
});

test("admin vê em modo suporte, só leitura, e tudo fica na auditoria", async ({ page }) => {
  const csp = watchCsp(page);
  const { user, admin } = accounts();
  await login(page, admin);
  await page.goto(`/admin/usuarios/${user.id}`);
  await page.getByLabel(/Motivo do acesso/).fill("Teste automatizado de suporte");
  await page.getByRole("button", { name: "Acessar ambiente para suporte" }).click();

  const banner = page.getByRole("region", { name: "Modo de suporte" });
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(banner).toContainText(user.fullName);
  await expect(banner).toContainText("somente leitura");
  await expect(page.getByRole("link", { name: /Emitir recibo/ })).toHaveCount(0);

  // Telas de escrita recusam o modo suporte.
  await page.goto("/emitir");
  await expect(page).toHaveURL(/suporte=somente-leitura/);
  await expect(page.getByText(/não está disponível no modo de suporte/)).toBeVisible();

  // Recibo: só visualizar/baixar — e o PDF aberto vai para a auditoria.
  await page.goto("/recibos");
  await page.getByRole("link", { name: new RegExp(PAYER) }).click();
  await expect(page.locator("main canvas").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Corrigir" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Duplicar" })).toHaveCount(0);

  await banner.getByRole("button").click();
  await expect(page).toHaveURL(/suporte=encerrado/);
  await expect(banner).toHaveCount(0);

  await page.goto(`/admin/auditoria?usuario=${user.id}`);
  await expect(page.getByText("Motivo: “Teste automatizado de suporte”")).toBeVisible();
  await expect(page.getByText(/abriu um PDF de/).first()).toBeVisible();
  await expect(page.getByText(/saiu do modo de suporte de/)).toBeVisible();
  expect(csp).toEqual([]);
});
