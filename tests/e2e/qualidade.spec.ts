import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { accounts, login } from "./helpers";

// Acessibilidade (WCAG 2.1 A/AA, via axe) e layout sem rolagem lateral
// de 320 a 1440 px nas telas principais.

const USER_PAGES = ["/dashboard", "/emitir", "/recibos", "/modelos", "/modelos/campos", "/perfil"];
const ADMIN_PAGES = ["/admin", "/admin/usuarios", "/admin/usuarios/novo", "/admin/auditoria"];

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function checkPage(page: Page, path: string, widths: number[]) {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  expect(await seriousViolations(page), path).toEqual([]);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(await horizontalOverflow(page), `${path} em ${width}px`).toBeLessThanOrEqual(0);
  }
}

test("login: acessível", async ({ page }) => {
  await page.goto("/login");
  expect(await seriousViolations(page)).toEqual([]);
});

test("área do usuário: acessível e sem rolagem lateral (320–1440 px)", async ({ page }) => {
  const { user } = accounts();
  await login(page, user);
  await page.goto("/emitir");
  await page.getByRole("link", { name: /Recibo padrão/ }).click();
  await expect(page.getByLabel("Nome do pagador")).toBeVisible();
  const emitForm = new URL(page.url()).pathname;
  // Página do recibo: existe quando o fluxo principal já rodou nesta execução.
  await page.goto("/recibos");
  const firstReceipt = page.locator("main ul a").first();
  const receipt = (await firstReceipt.count()) ? await firstReceipt.getAttribute("href") : null;
  await page.goto("/modelos");
  await page.getByRole("link", { name: "Recibo padrão" }).click();
  await expect(page).toHaveURL(/\/editar$/);
  const editor = new URL(page.url()).pathname;

  const pages = [...USER_PAGES, emitForm, editor, ...(receipt ? [receipt] : [])];
  for (const path of pages) await checkPage(page, path, [320, 768, 1440]);
});

test("área admin: acessível e sem rolagem lateral", async ({ page }) => {
  const { admin, user } = accounts();
  await login(page, admin);
  for (const path of [...ADMIN_PAGES, `/admin/usuarios/${user.id}`]) await checkPage(page, path, [320, 1440]);
});

test("cabeçalhos de segurança nas páginas, com nonce novo a cada requisição", async ({ page }) => {
  const response = await page.goto("/login");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  const again = await page.goto("/login");
  expect(again!.headers()["content-security-policy"]).not.toBe(headers["content-security-policy"]);
});

test("teclado: primeiro Tab leva ao atalho “Pular para o conteúdo”", async ({ page }) => {
  const { user } = accounts();
  await login(page, user);
  await page.goto("/recibos");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#conteudo")).toBeFocused();
});

// Por último: esgota o limite da prévia (dados inválidos → resposta rápida,
// sem gerar PDF). Os outros testes não dependem da prévia depois daqui.
test("limite de tentativas: a prévia de PDF recusa excesso com 429", async ({ page }) => {
  const { user } = accounts();
  await login(page, user);
  const statuses: number[] = [];
  for (let i = 0; i < 41; i++) {
    const response = await page.request.post("/api/recibos/previa", { data: { invalido: true } });
    statuses.push(response.status());
  }
  expect(statuses.slice(0, 40).every((s) => s === 400)).toBe(true);
  expect(statuses[40]).toBe(429);
  const last = await page.request.post("/api/recibos/previa", { data: {} });
  expect(await last.json()).toMatchObject({ error: expect.stringContaining("Muitas tentativas") });
  expect(last.headers()["retry-after"]).toBe("60");
});
