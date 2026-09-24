"use client";

import { useActionState, useId } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startSupport, type StartSupportState } from "@/features/support/actions";
import { SUPPORT_REASON_MAX } from "@/features/support/limits";

/** Abre o ambiente do usuário em modo de suporte (somente leitura), com motivo. */
export function SupportStart({ userId, displayName, available }: { userId: string; displayName: string; available: boolean }) {
  const [state, action, pending] = useActionState<StartSupportState, FormData>(startSupport, {});
  const reasonId = useId();

  if (!available) {
    return (
      <p className="text-sm text-slate-600">
        Disponível depois que {displayName} concluir a configuração inicial — até lá não há modelos nem recibos para ver.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm text-slate-600">
        Você vê o ambiente de {displayName} como a pessoa vê — recibos, modelos e perfil — <strong>somente para leitura</strong>,
        por até 30 minutos. A entrada, a saída e cada PDF aberto ficam registrados na auditoria.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={reasonId} className="text-sm font-medium text-slate-800">
          Motivo do acesso <span className="text-red-600">*</span>
        </label>
        <textarea
          id={reasonId}
          name="reason"
          rows={2}
          required
          minLength={5}
          maxLength={SUPPORT_REASON_MAX}
          placeholder="Ex.: ajuda para ajustar o modelo de recibo"
          aria-invalid={state.error ? true : undefined}
          className="block w-full rounded-lg bg-white px-3.5 py-3 text-base shadow-xs ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600"
        />
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" pending={pending} className="self-start">
        Acessar ambiente para suporte
      </Button>
    </form>
  );
}
