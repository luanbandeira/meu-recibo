"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { SIGNATURE_MODE_KEY, signatureModeOf, type SignatureMode } from "@/features/templates/document/signatures";
import type { FieldDefinition } from "@/features/templates/document/variables";
import { clearDraft, parseDraft, readDraftRaw, writeDraft } from "../draft";
import { flowPaths, type ReceiptFlow } from "../flow";
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
  flow,
  fields,
  defaults,
  seed,
  signatureChoice = false,
}: {
  flow: ReceiptFlow;
  fields: FieldDefinition[];
  /** Valores ao abrir sem rascunho (emissão: padrões; correção: a versão atual). */
  defaults: RawValues;
  /** Duplicar: substitui o rascunho desta aba pelos dados copiados. */
  seed?: { values: RawValues; notice: string };
  /** O modelo usa a sua assinatura digital e há imagem no Perfil: deixa escolher "à mão" neste recibo. */
  signatureChoice?: boolean;
}) {
  const router = useRouter();
  const paths = flowPaths(flow);
  const { draftId } = paths;
  // Rascunho salvo nesta aba (volta da prévia). No servidor: null.
  const draftRaw = useSyncExternalStore(noopSubscribe, () => readDraftRaw(draftId), () => null);
  const [edited, setEdited] = useState<RawValues | null>(seed?.values ?? null);
  const [seedNotice] = useState(seed?.notice ?? null);
  const values: RawValues = edited ?? { ...defaults, ...(parseDraft(draftRaw) ?? {}) };

  // Os dados copiados viram o rascunho, e a URL perde o ?duplicar= para que
  // recarregar a página não apague o que for digitado depois.
  useEffect(() => {
    if (!seed) return;
    writeDraft(draftId, seed.values);
    router.replace(paths.form, { scroll: false });
  }, [seed, draftId, paths.form, router]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [navigating, setNavigating] = useState(false);

  function update(key: string, raw: string, type: FieldDefinition["type"]) {
    const next = { ...values, [key]: maskInput(type, raw) };
    setEdited(next);
    writeDraft(draftId, next);
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function setSignatureMode(mode: SignatureMode) {
    const next = { ...values, [SIGNATURE_MODE_KEY]: mode };
    setEdited(next);
    writeDraft(draftId, next);
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
    writeDraft(draftId, values);
    setNavigating(true);
    router.push(paths.preview);
  }

  function clearForm() {
    clearDraft(draftId);
    setEdited({ ...defaults });
    setErrors({});
    setConfirmClear(false);
  }

  const errorCount = Object.keys(errors).length;
  const isCorrection = flow.kind === "correct";

  if (fields.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="info">Este modelo não tem campos a preencher. Todos os dados vêm do seu perfil.</Alert>
        <Button size="lg" onClick={() => router.push(paths.preview)}>
          Visualizar recibo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {seedNotice && <Alert tone="info">{seedNotice}</Alert>}
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

      {signatureChoice && (
        <fieldset className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:p-6">
          <legend className="sr-only">Sua assinatura neste recibo</legend>
          <p aria-hidden="true" className="text-sm font-medium text-slate-800">
            Sua assinatura neste recibo
          </p>
          {(
            [
              ["digital", "Assinatura digital", "Sai com a imagem da sua assinatura (do Perfil)."],
              ["manual", "Para assinar à mão", "Sai só a linha com seu nome — você imprime e assina."],
            ] as const
          ).map(([mode, title, description]) => (
            <label
              key={mode}
              className="flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 has-checked:bg-brand-50 has-checked:ring-brand-300"
            >
              <input
                type="radio"
                name={SIGNATURE_MODE_KEY}
                value={mode}
                checked={signatureModeOf(values) === mode}
                onChange={() => setSignatureMode(mode)}
                className="mt-1 size-4 shrink-0 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">{title}</span>
                <span className="block text-sm text-slate-600">{description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {/* Ações fixas no rodapé do celular */}
      <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-2xl bg-slate-50/95 py-2 backdrop-blur sm:static sm:flex-row sm:bg-transparent sm:py-0">
        <Button type="submit" size="lg" pending={navigating} className="sm:flex-1">
          Visualizar recibo
        </Button>
        {confirmClear ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-700">{isCorrection ? "Voltar aos dados salvos?" : "Apagar o que foi digitado?"}</span>
            <Button type="button" variant="danger" onClick={clearForm}>
              {isCorrection ? "Desfazer" : "Limpar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirmClear(true)}>
            {isCorrection ? "Desfazer alterações" : "Limpar formulário"}
          </Button>
        )}
      </div>
    </form>
  );
}
