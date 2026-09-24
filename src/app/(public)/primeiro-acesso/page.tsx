import type { Metadata } from "next";
import { requirePendingPasswordChange } from "@/features/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default async function FirstAccessPage() {
  const { profile } = await requirePendingPasswordChange();

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Crie sua senha</h1>
      <p className="mt-1 text-sm text-slate-600">
        Olá, {profile.display_name}. Por segurança, troque a senha temporária por uma senha só sua.
      </p>
      <div className="mt-6">
        <ChangePasswordForm />
      </div>
    </>
  );
}
