// Proteção do banco de PRODUÇÃO (clientes reais). Testes automáticos e
// scripts de desenvolvimento criam e apagam usuários — nunca podem rodar nele.
// O identificador do projeto não é segredo (aparece na URL pública do site).

export const PRODUCTION_PROJECT_REF = "fwnxlxgfhskiqxzgbdwo";
export const PRODUCTION_SITE_HOST = "meu-recibo-lilac.vercel.app";

export function pointsToProduction(value: string | undefined): boolean {
  return Boolean(value && value.includes(PRODUCTION_PROJECT_REF));
}

/** Interrompe se o ambiente carregado (.env.local) for o de produção. */
export function refuseProduction(what: string) {
  if (pointsToProduction(process.env.NEXT_PUBLIC_SUPABASE_URL) || pointsToProduction(process.env.SUPABASE_DB_URL)) {
    throw new Error(
      `${what} recusado: o .env.local aponta para o banco de PRODUÇÃO (${PRODUCTION_PROJECT_REF}). ` +
        "Use as chaves do projeto de desenvolvimento no .env.local.",
    );
  }
}
