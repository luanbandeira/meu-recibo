import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "@/lib/security/csp";

const directives = (csp: string) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("Content Security Policy", () => {
  const prod = directives(buildCsp({ nonce: "abc123", isDev: false, supabaseUrl: "https://proj.supabase.co/" }));

  it("produção: só scripts com o nonce da requisição, sem eval", () => {
    expect(prod["script-src"]).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(prod["script-src"]).not.toContain("'unsafe-inline'");
  });

  it("bloqueia embutir o site, plugins e envio de formulário para fora", () => {
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
  });

  it("libera só o próprio Supabase para imagens e conexões", () => {
    expect(prod["img-src"]).toContain("https://proj.supabase.co");
    expect(prod["connect-src"]).toEqual(["'self'", "https://proj.supabase.co"]);
  });

  it("desenvolvimento: eval e websocket (recarga automática)", () => {
    const dev = directives(buildCsp({ nonce: "n", isDev: true, supabaseUrl: "https://proj.supabase.co" }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
  });

  it("nonce novo e imprevisível a cada requisição", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
