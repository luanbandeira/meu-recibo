"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { InlineConfirm } from "@/components/ui/inline-confirm";
import { resetAccess, setUserStatus, type IssuedCredentials } from "@/features/admin/actions";
import { CredentialsCard } from "@/features/admin/components/credentials-card";
import type { AccountStatus } from "@/features/auth/session";

type Props = { userId: string; displayName: string; status: AccountStatus };

export function UserActions({ userId, displayName, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<"reset" | "status" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(null);

  function run(kind: "reset" | "status", task: () => Promise<void>) {
    setError(null);
    setSuccess(null);
    setRunning(kind);
    startTransition(async () => {
      await task();
      setRunning(null);
      router.refresh();
    });
  }

  if (credentials) {
    return <CredentialsCard credentials={credentials} title="Acesso redefinido" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      {status === "active" ? (
        <>
          <InlineConfirm
            trigger="Redefinir acesso"
            title={`Redefinir o acesso de ${displayName}?`}
            description="Será gerada uma nova senha temporária. A senha atual deixa de funcionar e a pessoa é desconectada de todos os aparelhos."
            confirmLabel="Gerar nova senha"
            pending={pending && running === "reset"}
            onConfirm={() =>
              run("reset", async () => {
                const result = await resetAccess(userId);
                if (result.ok) setCredentials(result.credentials);
                else setError(result.error);
              })
            }
          />
          <InlineConfirm
            trigger="Desativar usuário"
            tone="danger"
            title={`Desativar ${displayName}?`}
            description="A pessoa perde o acesso imediatamente e é desconectada. Os modelos e recibos dela são mantidos e voltam a ficar disponíveis se você reativar."
            confirmLabel="Desativar"
            pending={pending && running === "status"}
            onConfirm={() =>
              run("status", async () => {
                const result = await setUserStatus(userId, "disabled");
                if (result.ok) setSuccess("Usuário desativado.");
                else setError(result.error);
              })
            }
          />
        </>
      ) : (
        <InlineConfirm
          trigger="Reativar usuário"
          title={`Reativar ${displayName}?`}
          description="A pessoa volta a entrar com a senha que já tinha. Se ela não lembrar, use “Redefinir acesso” depois de reativar."
          confirmLabel="Reativar"
          pending={pending && running === "status"}
          onConfirm={() =>
            run("status", async () => {
              const result = await setUserStatus(userId, "active");
              if (result.ok) setSuccess("Usuário reativado.");
              else setError(result.error);
            })
          }
        />
      )}
    </div>
  );
}
