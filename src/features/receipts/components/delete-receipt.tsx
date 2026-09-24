"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { deleteReceipt } from "../actions";

/** Excluir recibo emitido por engano (com confirmação; não dá para desfazer). */
export function DeleteReceipt({ receiptId, number, versions }: { receiptId: string; number: string; versions: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <InlineConfirm
        trigger="Excluir recibo"
        tone="danger"
        title={`Excluir o recibo ${number}?`}
        description={
          <>
            O recibo{versions > 1 ? `, as ${versions} versões` : ""} e o PDF são apagados para sempre. O número {number} não
            será usado de novo — o próximo recibo continua a numeração. Se você já enviou este recibo para alguém, a cópia
            dessa pessoa continua existindo.
          </>
        }
        confirmLabel="Excluir para sempre"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            setError(null);
            const result = await deleteReceipt(receiptId);
            if (result && !result.ok) setError(result.error);
          })
        }
      />
    </div>
  );
}
