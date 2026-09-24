"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { createTemplate, type CreateTemplateState } from "@/features/templates/actions";
import { PresetPicker } from "@/features/templates/components/preset-picker";
import { templatePreset } from "@/features/templates/document/default-template";

export function NewTemplateForm() {
  const [state, formAction, pending] = useActionState(createTemplate, {} as CreateTemplateState);
  // Sugere o nome do modelo escolhido até a pessoa digitar o próprio.
  const [name, setName] = useState(templatePreset(undefined).name);
  const [nameEdited, setNameEdited] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:p-6">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <PresetPicker onSelect={(key) => !nameEdited && setName(templatePreset(key).name)} />
      <TextField
        label="Nome do modelo"
        name="name"
        required
        maxLength={100}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameEdited(true);
        }}
      />
      <Button type="submit" size="lg" pending={pending}>
        {pending ? "Criando…" : "Criar e editar"}
      </Button>
    </form>
  );
}
