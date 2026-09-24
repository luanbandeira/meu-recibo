"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { deleteTemplate, duplicateTemplate, setTemplateArchived } from "@/features/templates/actions";

export function TemplateActions({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(task: () => Promise<{ ok: boolean }>, failure: string) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) setError(failure);
      setConfirming(null);
      router.refresh();
    });
  }

  if (confirming) {
    const deleting = confirming === "delete";
    return (
      <div role="group" aria-label="Confirmação" className="flex flex-col gap-2 rounded-xl bg-red-50 p-3 text-sm ring-1 ring-red-200">
        <p className="text-slate-900">
          {deleting
            ? `Excluir “${name}” definitivamente? Recibos já emitidos com ele continuam guardados.`
            : `Arquivar “${name}”? Ele deixa de aparecer na emissão, mas pode ser restaurado.`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            pending={pending}
            onClick={() =>
              deleting
                ? run(() => deleteTemplate(id), "Não foi possível excluir.")
                : run(() => setTemplateArchived(id, true), "Não foi possível arquivar.")
            }
          >
            {deleting ? "Excluir" : "Arquivar"}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
      {archived ? (
        <>
          <Button variant="secondary" pending={pending} onClick={() => run(() => setTemplateArchived(id, false), "Não foi possível restaurar.")}>
            Restaurar
          </Button>
          <Button variant="ghost" className="text-red-700" onClick={() => setConfirming("delete")}>
            Excluir
          </Button>
        </>
      ) : (
        <>
          <LinkButton href={`/modelos/${id}/editar`}>Editar</LinkButton>
          <Button variant="secondary" pending={pending} onClick={() => run(() => duplicateTemplate(id), "Não foi possível duplicar.")}>
            Duplicar
          </Button>
          <Button variant="ghost" onClick={() => setConfirming("archive")}>
            Arquivar
          </Button>
        </>
      )}
    </div>
  );
}
