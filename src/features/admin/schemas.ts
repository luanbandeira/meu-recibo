import { z } from "zod";
import { USERNAME_PATTERN, normalizeUsername } from "@/features/auth/username";

export const createUserSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Informe o nome completo.")
    .max(120, "Use no máximo 120 caracteres."),
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(
      z
        .string()
        .min(3, "Use pelo menos 3 caracteres.")
        .max(32, "Use no máximo 32 caracteres.")
        .regex(
          USERNAME_PATTERN,
          "Use letras minúsculas, números, ponto, hífen ou sublinhado, começando por letra ou número.",
        ),
    ),
});

export const userIdSchema = z.uuid();
