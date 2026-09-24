import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, homePathFor } from "@/features/auth/session";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const session = await getSession();
  const disabled = params.erro === "conta-desativada";

  if (session && session.profile.status === "active") {
    redirect(homePathFor(session.profile));
  }

  const next = typeof params.next === "string" ? safeRedirectPath(params.next) : "/";

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Entrar</h1>
      <p className="mt-1 text-sm text-slate-600">Use o usuário e a senha que você recebeu.</p>
      <div className="mt-6">
        <LoginForm next={next} accountDisabled={disabled} />
      </div>
    </>
  );
}
