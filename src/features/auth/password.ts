import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;
// bcrypt (usado pelo Supabase Auth) ignora o que passa de 72 bytes.
export const PASSWORD_MAX_LENGTH = 72;

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      .max(PASSWORD_MAX_LENGTH, `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`)
      .regex(/[a-zA-Z]/, "Inclua pelo menos uma letra.")
      .regex(/[0-9]/, "Inclua pelo menos um número."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

// Sem caracteres ambíguos (0/O, 1/l/I) para facilitar o repasse ao usuário.
const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALPHABET = LETTERS + DIGITS;

function randomIndex(max: number): number {
  // Rejeição para evitar viés de módulo.
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

/** Senha temporária no formato xxxx-xxxx-xxxx (~68 bits), sempre com letra e número. */
export function generateTemporaryPassword(): string {
  for (;;) {
    const chars = Array.from({ length: 12 }, () => ALPHABET[randomIndex(ALPHABET.length)]);
    const candidate = chars.join("");
    if (/[a-zA-Z]/.test(candidate) && /[0-9]/.test(candidate)) {
      return candidate.match(/.{4}/g)!.join("-");
    }
  }
}
