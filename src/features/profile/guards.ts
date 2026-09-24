import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getProfessionalProfile } from "./queries";

/** Área principal do app: exige a configuração inicial concluída. */
export async function requireOnboardedUser() {
  const session = await requireUser();
  const professional = await getProfessionalProfile(session.userId);
  if (!professional?.onboarding_completed_at) redirect("/onboarding");
  return { ...session, professional };
}
