/**
 * Cria a conta de Super Admin (bootstrap). Rodar localmente:
 *   npm run admin:create -- --username admin --name "Seu Nome"
 * A senha temporária é exibida UMA vez e precisa ser trocada no primeiro acesso.
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { generateTemporaryPassword } from "../src/features/auth/password";
import { isValidUsername, normalizeUsername, usernameToAuthEmail } from "../src/features/auth/username";
import { loadLocalEnv, requireEnv } from "./env";

loadLocalEnv();

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    name: { type: "string" },
  },
});

const username = normalizeUsername(values.username ?? "");
const displayName = (values.name ?? "").trim();

if (!isValidUsername(username) || !displayName) {
  console.error('Uso: npm run admin:create -- --username <usuario> --name "Nome completo"');
  console.error("Usuário: 3–32 caracteres, letras minúsculas, números, ponto, hífen ou sublinhado.");
  process.exit(1);
}

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SECRET_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const password = generateTemporaryPassword();
const { error } = await supabase.auth.admin.createUser({
  email: usernameToAuthEmail(username, requireEnv("NEXT_PUBLIC_AUTH_EMAIL_DOMAIN")),
  password,
  email_confirm: true,
  app_metadata: { username, display_name: displayName, role: "super_admin" },
});

if (error) {
  console.error(`Não foi possível criar o administrador: ${error.message}`);
  process.exit(1);
}

console.log("\nSuper Admin criado.");
console.log(`  Usuário:          ${username}`);
console.log(`  Senha temporária: ${password}`);
console.log("\nGuarde a senha agora — ela não será exibida novamente.\n");
