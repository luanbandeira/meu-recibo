import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_TEMPLATE_SETTINGS, SURGICAL_TEMPLATE_CONTENT } from "../../src/features/templates/document/default-template";
import { extractVariables } from "../../src/features/templates/document/variables";
import { PRODUCTION_SITE_HOST, refuseProduction } from "../../scripts/production";
import { writeState, type E2EAccount } from "./state";

// Cria uma profissional fictícia já configurada (com o modelo padrão) e um
// super admin fictício. Nomes e documentos inventados; nomes de usuário
// "e2e-*" para a limpeza reconhecer.
export default async function globalSetup() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  // Cria e apaga contas: nunca no banco de produção nem contra o site oficial.
  refuseProduction("Teste E2E");
  if (process.env.E2E_BASE_URL?.includes(PRODUCTION_SITE_HOST)) {
    throw new Error("Teste E2E recusado: o site oficial usa o banco de produção. Use o servidor local ou um deploy de desenvolvimento.");
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const domain = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN!;
  const suffix = randomBytes(4).toString("hex");

  async function createAccount(username: string, fullName: string, role: "user" | "super_admin"): Promise<E2EAccount> {
    const password = `E2e-${randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@${domain}`,
      password,
      email_confirm: true,
      app_metadata: { username, display_name: fullName, role },
    });
    if (error || !data.user) throw new Error(`createUser ${username}: ${error?.message}`);
    await admin.from("profiles").update({ must_change_password: false }).eq("id", data.user.id);
    return { id: data.user.id, username, password, fullName };
  }

  const user = await createAccount(`e2e-pw-${suffix}`, "Beatriz Teste Automatizado", "user");
  const adminAccount = await createAccount(`e2e-pwadm-${suffix}`, "Admin Teste Automatizado", "super_admin");
  writeState({ user, admin: adminAccount });

  const profile = await admin.from("professional_profiles").insert({
    user_id: user.id,
    full_name: user.fullName,
    profession: "Fisioterapeuta",
    council: "CREFITO-1",
    registration_number: "000000-F",
    document_type: "cpf",
    document_number: "52998224725",
    phone: "81998765432",
    city: "Recife",
    state: "PE",
    onboarding_completed_at: new Date().toISOString(),
  });
  if (profile.error) throw new Error(`perfil: ${profile.error.message}`);

  const template = await admin.from("receipt_templates").insert({
    user_id: user.id,
    // Modelo com paciente e data do procedimento (os testes preenchem esses campos).
    name: "Recibo padrão",
    content: SURGICAL_TEMPLATE_CONTENT,
    settings: DEFAULT_TEMPLATE_SETTINGS,
    used_variables: extractVariables(SURGICAL_TEMPLATE_CONTENT),
    is_default: true,
  });
  if (template.error) throw new Error(`modelo: ${template.error.message}`);
}
