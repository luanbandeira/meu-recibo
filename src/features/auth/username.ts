// Login por usuário: o Supabase Auth exige e-mail, então cada username vira um
// e-mail sintético determinístico que o usuário nunca vê (docs/ARQUITETURA.md §5).

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function usernameToAuthEmail(username: string, domain: string): string {
  return `${normalizeUsername(username)}@${domain}`;
}
