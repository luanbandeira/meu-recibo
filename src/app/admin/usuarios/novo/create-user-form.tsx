"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { TextField } from "@/components/ui/text-field";
import { createUser, type CreateUserState } from "@/features/admin/actions";
import { CredentialsCard } from "@/features/admin/components/credentials-card";
import { sanitizeUsernameInput, suggestUsername } from "@/features/auth/username";

const initialState: CreateUserState = {};

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initialState);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);

  if (state.created) {
    return (
      <div className="flex flex-col gap-4">
        <CredentialsCard credentials={state.created} title="Usuário criado" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <LinkButton href={`/admin/usuarios/${state.created.userId}`} variant="secondary">
            Ver usuário
          </LinkButton>
          {/* Recarrega a página para limpar o estado (e a senha) da tela. */}
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Criar outro usuário
          </Button>
        </div>
      </div>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:p-6"
    >
      {state.formError && <Alert tone="error">{state.formError}</Alert>}
      <TextField
        label="Nome completo"
        name="displayName"
        autoComplete="off"
        required
        value={displayName}
        onChange={(event) => {
          setDisplayName(event.target.value);
          if (!usernameEdited) setUsername(suggestUsername(event.target.value));
        }}
        error={state.fieldErrors?.displayName}
      />
      <TextField
        label="Usuário"
        name="username"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        value={username}
        onChange={(event) => {
          setUsernameEdited(true);
          setUsername(sanitizeUsernameInput(event.target.value));
        }}
        hint="É com ele que a pessoa vai entrar. Letras minúsculas, números, ponto ou hífen."
        error={state.fieldErrors?.username}
      />
      <Button type="submit" size="lg" pending={pending}>
        {pending ? "Criando…" : "Criar usuário e gerar senha"}
      </Button>
    </form>
  );
}
