import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, newPasswordSchema } from "@/features/auth/password";
import {
  isValidUsername,
  normalizeUsername,
  sanitizeUsernameInput,
  suggestUsername,
  usernameAlternatives,
  usernameToAuthEmail,
} from "@/features/auth/username";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("username", () => {
  it("normaliza espaços e maiúsculas", () => {
    expect(normalizeUsername("  Mariana ")).toBe("mariana");
  });

  it.each(["mariana", "ana.paula", "joao_2", "m-s", "abc"])("aceita %s", (u) => {
    expect(isValidUsername(u)).toBe(true);
  });

  it.each(["ab", "", ".ana", "ana paula", "ana@x", "ç", "a".repeat(33), "Ana"])("rejeita %s", (u) => {
    expect(isValidUsername(u)).toBe(false);
  });

  it("gera e-mail sintético determinístico", () => {
    expect(usernameToAuthEmail("Mariana", "login.meurecibo.internal")).toBe(
      "mariana@login.meurecibo.internal",
    );
  });
});

describe("senha", () => {
  it("senha temporária tem formato xxxx-xxxx-xxxx e passa na política", () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/);
      expect(newPasswordSchema.safeParse({ password, confirmPassword: password }).success).toBe(true);
    }
  });

  it("senhas temporárias não se repetem", () => {
    const set = new Set(Array.from({ length: 500 }, generateTemporaryPassword));
    expect(set.size).toBe(500);
  });

  it("exige tamanho mínimo, letra, número e confirmação igual", () => {
    const check = (password: string, confirmPassword = password) =>
      newPasswordSchema.safeParse({ password, confirmPassword }).success;
    expect(check("curta1")).toBe(false);
    expect(check("somenteletras")).toBe(false);
    expect(check("1234567890")).toBe(false);
    expect(check("senhaforte123", "senhaforte124")).toBe(false);
    expect(check("senhaforte123")).toBe(true);
  });
});

describe("safeRedirectPath", () => {
  it.each([
    ["/recibos", "/recibos"],
    ["/recibos?x=1", "/recibos?x=1"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["", "/"],
    [null, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});

describe("sugestão e digitação de usuário", () => {
  it.each([
    ["Mariana Conceição", "mariana.conceicao"],
    ["Maria Souza", "maria.souza"],
    ["  José da Silva", "jose.silva"],
    ["Ana Maria dos Santos Oliveira", "ana.oliveira"],
    ["Ângela", "angela"],
    ["Da Silva", "da.silva"],
    ["Al", ""],
    ["", ""],
  ])("%s → %s", (name, expected) => {
    expect(suggestUsername(name)).toBe(expected);
  });

  it("sugestão longa demais é cortada sem terminar em ponto", () => {
    const username = suggestUsername(`Maria ${"Sobrenomecomprido".repeat(3)}`);
    expect(username.length).toBeLessThanOrEqual(32);
    expect(username).toMatch(/^maria\.[a-z]+$/);
  });

  it("alternativas numeradas quando o usuário já existe, sempre válidas", () => {
    expect(usernameAlternatives("maria.souza", 3)).toEqual(["maria.souza2", "maria.souza3", "maria.souza4"]);
    for (const alt of usernameAlternatives("a".repeat(32), 12)) {
      expect(alt.length).toBeLessThanOrEqual(32);
      expect(isValidUsername(alt)).toBe(true);
    }
    expect(usernameAlternatives("abc.", 1)).toEqual(["abc2"]);
  });

  it("remove acentos, espaços e caracteres inválidos enquanto digita", () => {
    expect(sanitizeUsernameInput("Maria José!")).toBe("maria.jose");
    expect(sanitizeUsernameInput("a".repeat(40))).toHaveLength(32);
  });
});
