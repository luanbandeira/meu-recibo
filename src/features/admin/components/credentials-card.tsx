"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { IssuedCredentials } from "../actions";

const noopSubscribe = () => () => {};

function accessMessage(credentials: IssuedCredentials, origin: string) {
  return [
    `Olá, ${credentials.displayName}! Seu acesso ao MeuRecibo:`,
    ``,
    `Endereço: ${origin}`,
    `Usuário: ${credentials.username}`,
    `Senha temporária: ${credentials.temporaryPassword}`,
    ``,
    `No primeiro acesso você vai criar sua própria senha.`,
  ].join("\n");
}

/** Mostra a senha temporária UMA vez, com atalhos para copiar/compartilhar. */
export function CredentialsCard({ credentials, title }: { credentials: IssuedCredentials; title: string }) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);
  // Só no cliente: evita divergência de hidratação.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(accessMessage(credentials, window.location.origin));
      setCopied(true);
    } catch {
      setShareError(true);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Acesso ao MeuRecibo", text: accessMessage(credentials, window.location.origin) });
    } catch (error) {
      if ((error as Error).name !== "AbortError") setShareError(true);
    }
  }

  return (
    <section
      aria-labelledby="credentials-title"
      className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-200 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
          ✓
        </span>
        <div>
          <h2 id="credentials-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <p className="text-sm text-slate-600">Envie estes dados para {credentials.displayName}.</p>
        </div>
      </div>

      <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Usuário</dt>
          <dd className="font-mono text-lg text-slate-900">{credentials.username}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Senha temporária</dt>
          <dd className="font-mono text-lg tracking-wider text-slate-900">{credentials.temporaryPassword}</dd>
        </div>
      </dl>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
        <strong>Atenção:</strong> esta senha não será exibida novamente. Se ela se perder, use “Redefinir acesso”.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={copy} variant={canShare ? "secondary" : "primary"}>
          {copied ? "Mensagem copiada ✓" : "Copiar mensagem de acesso"}
        </Button>
        {canShare && <Button onClick={share}>Compartilhar…</Button>}
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Mensagem copiada para a área de transferência." : ""}
      </p>
      {shareError && (
        <p className="text-sm text-red-700">Não foi possível copiar/compartilhar. Anote os dados acima.</p>
      )}
    </section>
  );
}
