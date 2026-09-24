"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { createField } from "@/features/fields/actions";
import { FIELD_TYPE_LABELS, FIELD_TYPES } from "@/features/fields/schema";
import { suggestFieldKey, type CatalogVariable, type FieldType } from "@/features/templates/document/variables";

const groups: { id: CatalogVariable["group"]; label: string; hint: string }[] = [
  { id: "fields", label: "Preenchidos na emissão", hint: "Viram campos do formulário ao emitir." },
  { id: "profile", label: "Seus dados", hint: "Preenchidos automaticamente pelo seu perfil." },
  { id: "auto", label: "Automáticos", hint: "Gerados pelo sistema." },
];

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function VariablePicker({
  catalog,
  onPick,
  onFieldCreated,
  onClose,
}: {
  catalog: CatalogVariable[];
  onPick: (key: string) => void;
  onFieldCreated: (variable: CatalogVariable) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? catalog.filter((v) => normalize(`${v.label} ${v.key}`).includes(q)) : catalog;
  }, [catalog, query]);

  return (
    <div
      role="dialog"
      aria-label="Inserir variável"
      className="flex max-h-[70vh] w-full flex-col gap-3 overflow-hidden rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200 sm:w-96"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {creating ? (
        <CreateFieldForm
          initialLabel={query}
          onCancel={() => setCreating(false)}
          onCreated={(variable) => {
            onFieldCreated(variable);
            onPick(variable.key);
          }}
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="variable-search" className="sr-only">
              Buscar variável
            </label>
            <input
              id="variable-search"
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar: valor, paciente, data…"
              className="min-h-11 w-full rounded-lg px-3 text-base ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">
              Fechar
            </button>
          </div>

          <div className="-mx-1 overflow-y-auto px-1">
            {groups.map((group) => {
              const items = filtered.filter((v) => v.group === group.id);
              if (!items.length) return null;
              return (
                <section key={group.id} className="mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h3>
                  <p className="mb-1 text-xs text-slate-500">{group.hint}</p>
                  <ul>
                    {items.map((v) => (
                      <li key={v.key}>
                        <button
                          type="button"
                          onClick={() => onPick(v.key)}
                          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-slate-100"
                        >
                          <span className="text-slate-900">{v.label}</span>
                          <code className="shrink-0 text-xs text-slate-500">{`{{${v.key}}}`}</code>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {filtered.length === 0 && <p className="py-4 text-center text-sm text-slate-600">Nenhuma variável encontrada.</p>}
          </div>

          <Button variant="secondary" onClick={() => setCreating(true)}>
            + Criar campo personalizado
          </Button>
        </>
      )}
    </div>
  );
}

function CreateFieldForm({
  initialLabel,
  onCancel,
  onCreated,
}: {
  initialLabel: string;
  onCancel: () => void;
  onCreated: (variable: CatalogVariable) => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [key, setKey] = useState(suggestFieldKey(initialLabel));
  const [keyEdited, setKeyEdited] = useState(false);
  const [type, setType] = useState<FieldType>("short_text");
  const [required, setRequired] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    setPending(true);
    const result = await createField({ label, key, type, required, defaultValue: null });
    setPending(false);
    if (result.ok) {
      onCreated({ key: result.field.key, label: result.field.label, group: "fields", type: result.field.type });
    } else {
      setErrors({ ...result.errors, form: result.error });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 overflow-y-auto" noValidate>
      <p className="font-medium text-slate-900">Novo campo personalizado</p>
      {errors.form && <p className="text-sm text-red-700">{errors.form}</p>}
      <TextField
        label="Nome do campo"
        autoFocus
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          if (!keyEdited) setKey(suggestFieldKey(e.target.value));
        }}
        placeholder="Ex.: Nome do cirurgião"
        error={errors.label}
      />
      <TextField
        label="Identificador"
        value={key}
        onChange={(e) => {
          setKeyEdited(true);
          setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
        }}
        hint={key ? `Aparece no modelo como {{${key}}}` : undefined}
        error={errors.key}
        autoCapitalize="none"
        spellCheck={false}
      />
      <SelectField
        label="Tipo"
        value={type}
        onChange={(e) => setType(e.target.value as FieldType)}
        options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))}
        error={errors.type}
      />
      <label className="flex min-h-11 items-center gap-3 text-sm text-slate-900">
        <input type="checkbox" className="size-5 accent-brand-600" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Obrigatório na emissão
      </label>
      <div className="flex gap-2">
        <Button type="submit" pending={pending}>
          Criar e inserir
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
