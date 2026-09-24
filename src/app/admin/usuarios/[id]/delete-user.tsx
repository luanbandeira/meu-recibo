"use client";

import { useActionState, useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteUser, type DeleteUserState } from "@/features/admin/actions";
import type { UserDataSummary } from "@/features/admin/queries";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Exclusão definitiva (LGPD). Só aparece para conta desativada e exige digitar
 * o nome de usuário — não há como desfazer.
 */
export function DeleteUser({
  userId,
  username,
  displayName,
  disabled,
  summary,
}: {
  userId: string;
  username: string;
  displayName: string;
  disabled: boolean;
  summary: UserDataSummary;
}) {
  const [state, action, pending] = useActionState<DeleteUserState, FormData>(deleteUser, {});
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const inputId = useId();

  if (!disabled) {
    return (
      <p className="text-sm text-slate-600">
        Para excluir, desative o usuário primeiro. A exclusão é usada para atender pedidos de remoção de dados (LGPD) e não
        pode ser desfeita.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          Remove a conta de {displayName} e todos os dados dela, para atender a um pedido de exclusão (LGPD). Não pode ser
          desfeito.
        </p>
        <Button variant="danger" className="self-start" onClick={() => setOpen(true)}>
          Excluir definitivamente…
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
      <input type="hidden" name="userId" value={userId} />
      <div className="text-sm text-red-950">
        <p className="font-semibold">Isto apaga para sempre:</p>
        <ul className="mt-1 list-disc pl-5">
          <li>a conta e o acesso de {displayName};</li>
          <li>{plural(summary.receipts, "recibo emitido", "recibos emitidos")} (com todas as versões e PDFs);</li>
          <li>{plural(summary.templates, "modelo", "modelos")}, campos e o perfil profissional;</li>
          <li>{plural(summary.files, "arquivo guardado", "arquivos guardados")} (logo, assinatura e PDFs).</li>
        </ul>
        <p className="mt-2">
          A auditoria continua registrando o que os administradores fizeram, mas sem identificar a pessoa. Se ela precisar
          dos recibos, baixe antes pelo modo de suporte.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-900">
          Para confirmar, digite o nome de usuário: <span className="font-mono">{username}</span>
        </label>
        <input
          id={inputId}
          name="confirmation"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="block min-h-12 w-full rounded-lg bg-white px-3.5 text-base shadow-xs ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600"
        />
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" pending={pending} disabled={typed.trim().toLowerCase() !== username}>
          Excluir {displayName} para sempre
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
