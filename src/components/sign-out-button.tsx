"use client";

import { signOut } from "@/features/auth/actions";
import { clearAllDrafts } from "@/features/receipts/draft";

/** Sair também apaga rascunhos de recibo (dados de pacientes) deste aparelho. */
export function SignOutButton() {
  return (
    <form action={signOut} onSubmit={clearAllDrafts}>
      <button type="submit" className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
        Sair
      </button>
    </form>
  );
}
