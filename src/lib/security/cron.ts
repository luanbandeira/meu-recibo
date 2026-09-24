import { timingSafeEqual } from "node:crypto";

/**
 * A Vercel chama os Cron Jobs com "Authorization: Bearer <CRON_SECRET>"
 * quando a variável CRON_SECRET existe no projeto. Sem a variável
 * configurada, recusa sempre (não há como distinguir a Vercel de um curioso).
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
