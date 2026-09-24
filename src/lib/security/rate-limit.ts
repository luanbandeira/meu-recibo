import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Limites por usuário e por ação, contados no banco (vale entre instâncias da
// Vercel). Generosos para uso normal — pegam só abuso ou script descontrolado.
// Login fica com o limite do próprio Supabase Auth (por IP).
export const RATE_LIMITS = {
  pdfPreview: { max: 40, windowSeconds: 60 },
  pdfDownload: { max: 120, windowSeconds: 60 },
  receiptIssue: { max: 20, windowSeconds: 60 },
  pdfRetry: { max: 10, windowSeconds: 60 },
  receiptDelete: { max: 30, windowSeconds: 3600 },
  templateSave: { max: 120, windowSeconds: 60 },
  templateCreate: { max: 30, windowSeconds: 3600 },
  fieldCreate: { max: 30, windowSeconds: 3600 },
  assetUpload: { max: 30, windowSeconds: 3600 },
  adminUserAction: { max: 30, windowSeconds: 3600 },
  supportStart: { max: 20, windowSeconds: 3600 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export const RATE_LIMIT_MESSAGE = "Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.";

/**
 * Registra uma tentativa de `subject` (id do usuário) na ação `name` e diz se
 * ainda está dentro do limite. Se o contador falhar (banco indisponível),
 * deixa passar: o limite protege contra abuso, não é autorização.
 */
export async function withinRateLimit(name: RateLimitName, subject: string): Promise<boolean> {
  const { max, windowSeconds } = RATE_LIMITS[name];
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_key: `${name}:${subject}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] falha ao contar", { name, code: error.code });
    return true;
  }
  return data === true;
}
