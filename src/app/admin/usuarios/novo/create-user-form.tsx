"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { TextField } from "@/components/ui/text-field";
import { createUser, suggestAvailableUsername, type CreateUserState } from "@/features/admin/actions";
import { CredentialsCard } from "@/features/admin/components/credentials-card";
import { sanitizeUsernameInput, suggestUsername } from "@/features/auth/username";

const initialState: CreateUserState = {};

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initialState);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);

  // Enquanto digita o nome: sugestão local na hora (maria.souza) e, logo em
  // seguida, a versão já livre conferida no servidor (maria.souza2).
  const lookup = useRef(0);
  useEffect(() => {
    if (usernameEdited || !displayName.trim()) return;
    const id = ++lookup.current;
    const timer = setTimeout(async () => {
      const available = await suggestAvailableUsername(displayName).catch(() => "");
      if (available && id === lookup.current) setUsername(available);
    }, 400);
    return () => clearTimeout(timer);
  }, [displayName, usernameEdited]);

  // Usuário já existia ao criar: preenche a sugestão livre que o servidor achou.
  const [appliedSuggestion, setAppliedSuggestion] = useState<string | undefined>(undefined);
  if (state.suggestedUsername && state.suggestedUsername !== appliedSuggestion) {
    setAppliedSuggestion(state.suggestedUsername);
    setUsername(state.suggestedUsername);
  }

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
