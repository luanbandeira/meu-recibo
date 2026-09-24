import "server-only";
import { redirect } from "next/navigation";
import { getSession, requireSuperAdmin, requireUser } from "@/features/auth/session";
import { getActiveSupportSession, type SupportSession } from "@/features/support/session";
import { getProfessionalProfile } from "./queries";

/**
 * Área principal do app: exige a configuração inicial concluída.
 *
 * Modo suporte: um super admin com sessão de suporte aberta vê o ambiente do
 * usuário-alvo (`userId` passa a ser o do alvo) — SOMENTE LEITURA. Por padrão
 * toda página e toda ação recusa o modo suporte; só as telas de consulta
 * passam `{ allowSupport: true }`. Mesmo que uma escrita escapasse, a RLS a
 * bloqueia (as policies de escrita exigem o próprio auth.uid()).
 */
export async function requireOnboardedUser(options: { allowSupport?: boolean } = {}) {
  const current = await getSession();

  if (current?.profile.role === "super_admin") {
    const session = await requireSuperAdmin();
    const support = await getActiveSupportSession();
    if (!support) redirect("/admin?suporte=encerrado");
    if (!options.allowSupport) redirect("/dashboard?suporte=somente-leitura");
    const professional = await getProfessionalProfile(support.targetUserId);
    if (!professional?.onboarding_completed_at) redirect(`/admin/usuarios/${support.targetUserId}?suporte=sem-configuracao`);
    return { ...session, userId: support.targetUserId, professional, support: support as SupportSession | null };
  }

  const session = await requireUser();
  const professional = await getProfessionalProfile(session.userId);
  if (!professional?.onboarding_completed_at) redirect("/onboarding");
  return { ...session, professional, support: null as SupportSession | null };
}
