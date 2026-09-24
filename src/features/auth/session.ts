import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "user" | "super_admin";
export type AccountStatus = "active" | "disabled";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  status: AccountStatus;
  must_change_password: boolean;
};

export type Session = {
  userId: string;
  profile: Profile;
};

/** Sessão + perfil, carregados uma vez por request. `null` se não autenticado. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, status, must_change_password")
    .eq("id", userId)
    .single<Profile>();

  if (!profile) return null;
  return { userId, profile };
});

export function homePathFor(profile: Profile): string {
  if (profile.must_change_password) return "/primeiro-acesso";
  return profile.role === "super_admin" ? "/admin" : "/dashboard";
}

/** Autenticado e ativo. Não verifica troca de senha pendente. */
async function requireActiveSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.status !== "active") redirect("/auth/sair?erro=conta-desativada");
  return session;
}

/** Área do usuário comum: ativo, senha definitiva, papel "user". */
export async function requireUser(): Promise<Session> {
  const session = await requireActiveSession();
  if (session.profile.must_change_password) redirect("/primeiro-acesso");
  if (session.profile.role !== "user") redirect(homePathFor(session.profile));
  return session;
}

/** Área administrativa: ativo, senha definitiva, papel "super_admin". */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireActiveSession();
  if (session.profile.must_change_password) redirect("/primeiro-acesso");
  if (session.profile.role !== "super_admin") redirect(homePathFor(session.profile));
  return session;
}

/** Tela de troca obrigatória de senha. */
export async function requirePendingPasswordChange(): Promise<Session> {
  const session = await requireActiveSession();
  if (!session.profile.must_change_password) redirect(homePathFor(session.profile));
  return session;
}
