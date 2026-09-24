"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/text-field";
import { changeTemporaryPassword, type ChangePasswordState } from "@/features/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/password";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeTemporaryPassword, initialState);

  // Chamamos a action manualmente (em vez de <form action>) porque o React
  // limpa o formulário após a action e o usuário perderia o que digitou.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {state.formError && <Alert tone="error">{state.formError}</Alert>}
      <PasswordField
        label="Nova senha"
        name="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        required
        hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`}
        error={state.fieldErrors?.password}
      />
      <PasswordField
        label="Confirme a nova senha"
        name="confirmPassword"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <Button type="submit" size="lg" fullWidth pending={pending}>
        {pending ? "Salvando…" : "Salvar e continuar"}
      </Button>
    </form>
  );
}
