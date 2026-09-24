"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { createTemplate, type CreateTemplateState } from "@/features/templates/actions";

const bases = [
  { value: "default", title: "A partir do recibo padrão", description: "Cabeçalho, texto de honorários, local/data e assinatura prontos." },
  { value: "blank", title: "Em branco", description: "Só cabeçalho e assinatura; você escreve o texto." },
];

export function NewTemplateForm() {
  const [state, formAction, pending] = useActionState(createTemplate, {} as CreateTemplateState);
  const [base, setBase] = useState("default");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:p-6">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <TextField label="Nome do modelo" name="name" required maxLength={100} placeholder="Ex.: Honorários cirúrgicos" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-800">Começar</legend>
        {bases.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-inset ${base === option.value ? "bg-brand-50 ring-brand-300" : "ring-slate-200 hover:bg-slate-50"}`}
          >
            <input
              type="radio"
              name="base"
              value={option.value}
              checked={base === option.value}
              onChange={() => setBase(option.value)}
              className="mt-1 size-4 accent-brand-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">{option.title}</span>
              <span className="block text-sm text-slate-600">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Button type="submit" size="lg" pending={pending}>
        {pending ? "Criando…" : "Criar e editar"}
      </Button>
    </form>
  );
}
