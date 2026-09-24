"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { UFS, formatCpfCnpj, formatPhone } from "@/lib/format/br";
import { saveProfessionalProfile, type SaveProfileState } from "../actions";
import { COMMON_COUNCILS } from "../schema";

export type ProfileFormValues = {
  fullName: string;
  companyName: string;
  profession: string;
  council: string;
  registrationNumber: string;
  document: string;
  phone: string;
  city: string;
  state: string;
};

const initialState: SaveProfileState = {};

export function ProfessionalProfileForm({
  initial,
  intent,
}: {
  initial: ProfileFormValues;
  intent: "onboarding" | "profile";
}) {
  const [state, formAction, pending] = useActionState(saveProfessionalProfile, initialState);
  const [values, setValues] = useState<ProfileFormValues>({
    ...initial,
    document: formatCpfCnpj(initial.document),
    phone: formatPhone(initial.phone),
  });
  // Contadores locais (não dependem do relógio do servidor): há alterações
  // pendentes se houve edição depois do último envio salvo com sucesso.
  const [editCount, setEditCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);
  const dirty = state.savedAt ? editCount > submittedCount : editCount > 0;
  const errors = state.fieldErrors ?? {};

  // Avisa antes de sair com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof ProfileFormValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setEditCount((count) => count + 1);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmittedCount(editCount);
    startTransition(() => formAction(formData));
  }

  const councilSuggestions = values.state ? COMMON_COUNCILS.map((c) => `${c}-${values.state}`) : COMMON_COUNCILS;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="intent" value={intent} />
      {state.formError && <Alert tone="error">{state.formError}</Alert>}
      {state.savedAt && !dirty && <Alert tone="success">Dados salvos.</Alert>}

      <TextField
        label="Nome completo"
        name="fullName"
        autoComplete="name"
        value={values.fullName}
        onChange={(e) => set("fullName", e.target.value)}
        error={errors.fullName}
        hint="Como deve aparecer no recibo."
      />
      <TextField
        label="Profissão ou especialidade"
        name="profession"
        value={values.profession}
        onChange={(e) => set("profession", e.target.value)}
        error={errors.profession}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="CPF ou CNPJ"
          name="document"
          inputMode="numeric"
          autoComplete="off"
          value={values.document}
          onChange={(e) => set("document", formatCpfCnpj(e.target.value))}
          error={errors.document}
        />
        <TextField
          label="Telefone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={values.phone}
          onChange={(e) => set("phone", formatPhone(e.target.value))}
          error={errors.phone}
          placeholder="(81) 99999-9999"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <TextField
          label="Cidade"
          name="city"
          autoComplete="address-level2"
          value={values.city}
          onChange={(e) => set("city", e.target.value)}
          error={errors.city}
        />
        <SelectField
          label="Estado"
          name="state"
          value={values.state}
          onChange={(e) => set("state", e.target.value)}
          error={errors.state}
          placeholder="UF"
          options={UFS.map((uf) => ({ value: uf, label: uf }))}
        />
      </div>

      <fieldset className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
        <legend className="px-1 text-sm font-medium text-slate-800">Registro profissional (se houver)</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Conselho"
            name="council"
            list="council-suggestions"
            autoCapitalize="characters"
            value={values.council}
            onChange={(e) => set("council", e.target.value.toUpperCase())}
            error={errors.council}
            placeholder={values.state ? `Ex.: COREN-${values.state}` : "Ex.: COREN-PE"}
          />
          <TextField
            label="Número do registro"
            name="registrationNumber"
            value={values.registrationNumber}
            onChange={(e) => set("registrationNumber", e.target.value)}
            error={errors.registrationNumber}
            placeholder="Ex.: 123456"
          />
        </div>
        <datalist id="council-suggestions">
          {councilSuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </fieldset>

      <TextField
        label="Razão social (opcional)"
        name="companyName"
        autoComplete="organization"
        value={values.companyName}
        onChange={(e) => set("companyName", e.target.value)}
        error={errors.companyName}
      />

      <Button type="submit" size="lg" pending={pending}>
        {pending ? "Salvando…" : intent === "onboarding" ? "Salvar e continuar" : "Salvar alterações"}
      </Button>
    </form>
  );
}
