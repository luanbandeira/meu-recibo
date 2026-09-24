"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { createField, setFieldArchived, updateField } from "@/features/fields/actions";
import { FIELD_TYPE_LABELS, FIELD_TYPES, TYPES_WITH_DEFAULT } from "@/features/fields/schema";
import { suggestFieldKey, type FieldDefinition, type FieldType } from "@/features/templates/document/variables";
import { formatBRL, maskBRLInput } from "@/lib/format/money";

function displayDefault(field: Pick<FieldDefinition, "type" | "default_value">) {
  if (!field.default_value) return "";
  return field.type === "currency" ? formatBRL(Number(field.default_value)) : field.default_value;
}

function DefaultValueInput({
  type,
  value,
  onChange,
  error,
}: {
  type: FieldType;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  if (!TYPES_WITH_DEFAULT.includes(type)) return null;
  return (
    <TextField
      label="Valor padrão (opcional)"
      value={value}
      inputMode={type === "currency" || type === "number" ? "decimal" : undefined}
      onChange={(e) => onChange(type === "currency" ? maskBRLInput(e.target.value).display : e.target.value)}
      hint="Já vem preenchido na emissão; pode ser alterado a cada recibo."
      error={error}
    />
  );
}

export function FieldsManager({ initialFields, readOnly = false }: { initialFields: FieldDefinition[]; readOnly?: boolean }) {
  const [fields, setFields] = useState(initialFields);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const replace = (field: FieldDefinition) => setFields((list) => list.map((f) => (f.id === field.id ? field : f)));

  const active = fields.filter((f) => !f.archived_at);
  const archived = fields.filter((f) => f.archived_at);

  return (
    <div className="flex flex-col gap-6">
      {readOnly ? null : creating ? (
        <NewFieldForm
          onCancel={() => setCreating(false)}
          onCreated={(field) => {
            setFields((list) => [...list, field]);
            setCreating(false);
          }}
        />
      ) : (
        <Button onClick={() => setCreating(true)} className="self-start">
          + Novo campo personalizado
        </Button>
      )}

      <ul className="flex flex-col gap-2">
        {active.map((field) => (
          <li key={field.id} className="rounded-xl bg-white p-4 shadow-xs ring-1 ring-slate-200">
            {editing === field.id ? (
              <EditFieldForm field={field} onCancel={() => setEditing(null)} onSaved={(f) => { replace(f); setEditing(null); }} />
            ) : (
              <FieldRow
                field={field}
                readOnly={readOnly}
                onEdit={() => setEditing(field.id)}
                onArchive={async () => {
                  const result = await setFieldArchived(field.id, true);
                  if (result.ok) replace({ ...field, archived_at: new Date().toISOString() });
                }}
              />
            )}
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <section aria-labelledby="archived-title" className="flex flex-col gap-2">
          <h2 id="archived-title" className="text-sm font-semibold text-slate-700">
            Arquivados (não aparecem para inserir em modelos)
          </h2>
          <ul className="flex flex-col gap-2">
            {archived.map((field) => (
              <li key={field.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/60 p-3 ring-1 ring-slate-200">
                <span className="text-sm text-slate-600">
                  {field.label} <code className="text-xs">{`{{${field.key}}}`}</code>
                </span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      const result = await setFieldArchived(field.id, false);
                      if (result.ok) replace({ ...field, archived_at: null });
                    }}
                  >
                    Restaurar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FieldRow({
  field,
  readOnly,
  onEdit,
  onArchive,
}: {
  field: FieldDefinition;
  readOnly: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{field.label}</span>
          {field.required && <Badge tone="warning">Obrigatório</Badge>}
          {!field.is_system && <Badge tone="neutral">Personalizado</Badge>}
        </div>
        <p className="text-sm text-slate-600">
          {FIELD_TYPE_LABELS[field.type]} · <code className="text-xs">{`{{${field.key}}}`}</code>
          {field.default_value && <> · padrão: {displayDefault(field)}</>}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {readOnly ? null : confirm ? (
          <>
            <Button variant="danger" onClick={onArchive}>Confirmar</Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onEdit}>Editar</Button>
            <Button variant="ghost" onClick={() => setConfirm(true)}>Arquivar</Button>
          </>
        )}
      </div>
    </div>
  );
}

function EditFieldForm({ field, onCancel, onSaved }: { field: FieldDefinition; onCancel: () => void; onSaved: (f: FieldDefinition) => void }) {
  const [label, setLabel] = useState(field.label);
  const [required, setRequired] = useState(field.required);
  const [defaultValue, setDefaultValue] = useState(displayDefault(field));
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await updateField({ id: field.id, label, required, defaultValue });
    setPending(false);
    if (result.ok) onSaved(result.field);
    else setErrors({ ...result.errors, form: result.error });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {errors.form && <Alert tone="error">{errors.form}</Alert>}
      <TextField label="Nome do campo" value={label} onChange={(e) => setLabel(e.target.value)} error={errors.label} />
      <p className="text-sm text-slate-600">
        {FIELD_TYPE_LABELS[field.type]} · <code className="text-xs">{`{{${field.key}}}`}</code> (tipo e identificador não mudam)
      </p>
      <DefaultValueInput type={field.type} value={defaultValue} onChange={setDefaultValue} error={errors.defaultValue} />
      <label className="flex min-h-11 items-center gap-3 text-sm text-slate-900">
        <input type="checkbox" className="size-5 accent-brand-600" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Obrigatório na emissão
      </label>
      <div className="flex gap-2">
        <Button type="submit" pending={pending}>Salvar</Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Cancelar</Button>
      </div>
    </form>
  );
}

function NewFieldForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (f: FieldDefinition) => void }) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [type, setType] = useState<FieldType>("short_text");
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await createField({ label, key, type, required, defaultValue });
    setPending(false);
    if (result.ok) onCreated(result.field);
    else setErrors({ ...result.errors, form: result.error });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">Novo campo</h2>
      {errors.form && <Alert tone="error">{errors.form}</Alert>}
      <TextField
        label="Nome do campo"
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
        autoCapitalize="none"
        spellCheck={false}
        onChange={(e) => {
          setKeyEdited(true);
          setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
        }}
        hint={key ? `No modelo: {{${key}}}` : "Gerado a partir do nome."}
        error={errors.key}
      />
      <SelectField
        label="Tipo"
        value={type}
        onChange={(e) => {
          setType(e.target.value as FieldType);
          setDefaultValue("");
        }}
        options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))}
        error={errors.type}
      />
      <DefaultValueInput type={type} value={defaultValue} onChange={setDefaultValue} error={errors.defaultValue} />
      <label className="flex min-h-11 items-center gap-3 text-sm text-slate-900">
        <input type="checkbox" className="size-5 accent-brand-600" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Obrigatório na emissão
      </label>
      <div className="flex gap-2">
        <Button type="submit" pending={pending}>Criar campo</Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Cancelar</Button>
      </div>
    </form>
  );
}
