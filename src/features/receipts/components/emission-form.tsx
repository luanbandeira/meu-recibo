"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { FieldDefinition } from "@/features/templates/document/variables";
import { clearDraft, parseDraft, readDraftRaw, writeDraft } from "../draft";
import { maskInput, validateValues, type RawValues } from "../values";

const noopSubscribe = () => () => {};

/** Atributos de teclado/preenchimento por tipo (teclado certo no celular). */
function inputProps(field: FieldDefinition) {
  switch (field.type) {
    case "currency":
      return { inputMode: "numeric" as const, placeholder: "R$ 0,00" };
    case "number":
      return { inputMode: "decimal" as const };
    case "date":
      return { type: "date" };
    case "document":
      return { inputMode: "numeric" as const, placeholder: "CPF ou CNPJ" };
    case "phone":
      return { type: "tel", inputMode: "tel" as const, placeholder: "(00) 00000-0000" };
    default:
      return { autoCapitalize: "words" as const };
  }
}

function LongTextField({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDefinition;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {field.label}
        {field.required && <RequiredMark />}
      </label>
      <textarea
        id={id}
        name={field.key}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`block w-full rounded-lg bg-white px-3.5 py-3 text-base shadow-xs ring-1 ring-inset focus:outline-none focus:ring-2 ${
          error ? "ring-red-400 focus:ring-red-600" : "ring-slate-300 focus:ring-brand-600"
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-red-600">
        *
      </span>
      <span className="sr-only"> (obrigatório)</span>
    </>
  );
}

export function EmissionForm({
  templateId,
  fields,
  defaults,
}: {
  templateId: string;
  fields: FieldDefinition[];
  defaults: RawValues;
}) {
  const router = useRouter();
  // Rascunho salvo nesta aba (volta da prévia). No servidor: null.
  const draftRaw = useSyncExternalStore(noopSubscribe, () => readDraftRaw(templateId), () => null);
  const [edited, setEdited] = useState<RawValues | null>(null);
  const values: RawValues = edited ?? { ...defaults, ...(parseDraft(draftRaw) ?? {}) };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [navigating, setNavigating] = useState(false);

  function update(key: string, raw: string, type: FieldDefinition["type"]) {
    const next = { ...values, [key]: maskInput(type, raw) };
    setEdited(next);
    writeDraft(templateId, next);
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateValues(fields, values);
    if (!result.ok) {
      setErrors(result.errors);
      const first = fields.find((f) => result.errors[f.key]);
      if (first) document.querySelector<HTMLElement>(`[name="${first.key}"]`)?.focus();
      return;
    }
    writeDraft(templateId, values);
    setNavigating(true);
    router.push(`/emitir/${templateId}/previa`);
  }

  function clearForm() {
    clearDraft(templateId);
    setEdited({ ...defaults });
    setErrors({});
    setConfirmClear(false);
  }

  const errorCount = Object.keys(errors).length;

  if (fields.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="info">Este modelo não tem campos a preencher. Todos os dados vêm do seu perfil.</Alert>
        <Button size="lg" onClick={() => router.push(`/emitir/${templateId}/previa`)}>
          Visualizar recibo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {errorCount > 0 && (
        <Alert tone="error">
          {errorCount === 1 ? "Confira o campo destacado." : `Confira os ${errorCount} campos destacados.`}
        </Alert>
      )}

      <div className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:p-6">
        {fields.map((field) =>
          field.type === "long_text" ? (
            <LongTextField
              key={field.key}
              field={field}
              value={values[field.key] ?? ""}
              error={errors[field.key]}
              onChange={(v) => update(field.key, v, field.type)}
            />
          ) : (
            <TextField
              key={field.key}
              name={field.key}
              label={field.required ? `${field.label} *` : field.label}
              aria-required={field.required || undefined}
              value={values[field.key] ?? ""}
              onChange={(e) => update(field.key, e.target.value, field.type)}
              error={errors[field.key]}
              autoComplete="off"
              enterKeyHint="next"
              {...inputProps(field)}
            />
          ),
        )}
        <p className="text-xs text-slate-500">* obrigatório</p>
      </div>

      {/* Ações fixas no rodapé do celular */}
      <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-2xl bg-slate-50/95 py-2 backdrop-blur sm:static sm:flex-row sm:bg-transparent sm:py-0">
        <Button type="submit" size="lg" pending={navigating} className="sm:flex-1">
          Visualizar recibo
        </Button>
        {confirmClear ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-700">Apagar o que foi digitado?</span>
            <Button type="button" variant="danger" onClick={clearForm}>
              Limpar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirmClear(true)}>
            Limpar formulário
          </Button>
        )}
      </div>
    </form>
  );
}
