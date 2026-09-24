import { defineConfig } from "@playwright/test";

// Testes de ponta a ponta (navegador real) contra o projeto Supabase de DEV.
// Padrão: servidor local (reaproveita o `npm run dev` se já estiver rodando).
// E2E_BASE_URL=https://... roda contra um deploy (ex.: produção de testes).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    // Chrome já instalado na máquina: nada para baixar.
    channel: "chrome",
    // Celular é o uso principal (critério: fluxo completo em 375 px).
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: `${baseURL}/login`, reuseExistingServer: true, timeout: 180_000 },
});
