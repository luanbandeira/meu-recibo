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

/** Sugestão a partir do nome: primeiro nome, sem acentos ("Mariana Souza" → "luciane"). */
export function suggestUsername(fullName: string): string {
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  const candidate = sanitizeUsernameInput(firstName).replace(/^[._-]+/, "");
  return isValidUsername(candidate) ? candidate : "";
}

export function usernameToAuthEmail(username: string, domain: string): string {
  return `${normalizeUsername(username)}@${domain}`;
}
