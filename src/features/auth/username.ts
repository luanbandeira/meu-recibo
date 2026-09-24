// Login por usuário: o Supabase Auth exige e-mail, então cada username vira um
// e-mail sintético determinístico que o usuário nunca vê (docs/ARQUITETURA.md §5).

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

/** Remove acentos e caracteres fora do padrão enquanto a pessoa digita. */
export function sanitizeUsernameInput(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 32);
}

const NAME_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);

/**
 * Sugestão a partir do nome: primeiro nome + último sobrenome, sem acentos
 * ("Maria Souza" → "maria.souza"; "José da Silva" → "jose.silva").
 */
export function suggestUsername(fullName: string): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .map((word) => sanitizeUsernameInput(word).replace(/[._-]/g, ""))
    .filter(Boolean);
  const parts = words.filter((word, index) => index === 0 || !NAME_PARTICLES.has(word));
  if (parts.length === 0) return "";
  const candidate = (parts.length > 1 ? `${parts[0]}.${parts.at(-1)}` : parts[0]).slice(0, 32).replace(/[._-]+$/, "");
  return isValidUsername(candidate) ? candidate : "";
}

/** Alternativas quando o usuário já existe: maria.souza2, maria.souza3… (sempre até 32 caracteres). */
export function usernameAlternatives(base: string, count = 20): string[] {
  return Array.from({ length: count }, (_, i) => {
    const suffix = String(i + 2);
    return `${base.slice(0, 32 - suffix.length).replace(/[._-]+$/, "")}${suffix}`;
  });
}

export function usernameToAuthEmail(username: string, domain: string): string {
  return `${normalizeUsername(username)}@${domain}`;
}
