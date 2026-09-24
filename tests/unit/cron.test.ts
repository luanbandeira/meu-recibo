import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/lib/security/cron";

describe("rota do Cron Job (mantém o banco ativo)", () => {
  it("aceita só o cabeçalho exato enviado pela Vercel", () => {
    expect(isAuthorizedCron("Bearer segredo-longo", "segredo-longo")).toBe(true);
    expect(isAuthorizedCron("Bearer outro", "segredo-longo")).toBe(false);
    expect(isAuthorizedCron("segredo-longo", "segredo-longo")).toBe(false);
    expect(isAuthorizedCron(null, "segredo-longo")).toBe(false);
  });

  it("sem CRON_SECRET configurado, recusa sempre", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
  });
});
