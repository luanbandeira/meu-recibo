// Variáveis públicas precisam ser lidas literalmente (process.env.NEXT_PUBLIC_X)
// para o Next.js conseguir embuti-las no bundle do navegador.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}. Veja .env.example.`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  authEmailDomain: required(
    "NEXT_PUBLIC_AUTH_EMAIL_DOMAIN",
    process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN,
  ),
};
