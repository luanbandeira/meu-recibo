"use client";

import { useId } from "react";
import { IMAGE_SIZES, type ImageSize } from "@/features/templates/document/constants";
import {
  MAX_SIGNERS,
  ME_SIGNER,
  otherSigner,
  type OtherName,
  type Signer,
} from "@/features/templates/document/signatures";
import type { CatalogVariable } from "@/features/templates/document/variables";

// Painel do bloco "Assinaturas" no editor: quem assina, como, nome, documento
// e legenda de cada pessoa. Tudo vira atributo do bloco (validado no servidor).

const input =
  "block h-9 w-full min-w-0 rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600";

function Toggle<T extends string>({
  value,
  options,
  onChange,
  disabled = [],
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  disabled?: T[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-fit flex-wrap self-start rounded-md ring-1 ring-slate-200">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          disabled={disabled.includes(key)}
          aria-pressed={value === key}
          className={`whitespace-nowrap px-2.5 py-1.5 text-xs first:rounded-l-md last:rounded-r-md disabled:cursor-not-allowed disabled:opacity-40 ${value === key ? "bg-brand-600 text-white" : "hover:bg-slate-100"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const NAME_TEXT = "__texto";
const NAME_BLANK = "__branco";

function SignerCard({
  signer,
  index,
  canRemove,
  meTaken,
  catalog,
  onChange,
  onRemove,
}: {
  signer: Signer;
  index: number;
  canRemove: boolean;
  meTaken: boolean;
  catalog: CatalogVariable[];
  onChange: (next: Signer) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const textFields = catalog.filter((v) => v.group === "fields" && v.type === "short_text");
  const documentFields = catalog.filter((v) => v.group === "fields" && v.type === "document");

  function setName(choice: string) {
    if (signer.who !== "other") return;
    const name: OtherName =
      choice === NAME_BLANK ? { from: "blank" } : choice === NAME_TEXT ? { from: "text", text: "" } : { from: "field", key: choice };
    onChange({ ...signer, name });
  }

  const nameChoice =
    signer.who === "other" ? (signer.name.from === "field" ? signer.name.key : signer.name.from === "text" ? NAME_TEXT : NAME_BLANK) : "";

  return (
    <li className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pessoa {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50">
            Remover pessoa
          </button>
        )}
      </div>

      <Toggle
        label="Quem assina"
        value={signer.who}
        options={[
          ["me", "Eu (profissional)"],
          ["other", "Outra pessoa"],
        ]}
        disabled={meTaken && signer.who !== "me" ? ["me"] : []}
        onChange={(who) => onChange(who === "me" ? { ...ME_SIGNER, caption: signer.caption } : otherSigner({ caption: signer.caption }))}
      />

      {signer.who === "me" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Toggle
            label="Como você assina"
            value={signer.mode}
            options={[
              ["digital", "Assinatura digital"],
              ["manual", "Linha para assinar à mão"],
            ]}
            onChange={(mode) => onChange({ ...signer, mode })}
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-700">
            <input type="checkbox" checked={signer.showName} onChange={(e) => onChange({ ...signer, showName: e.target.checked })} />
            Nome e registro abaixo
          </label>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700" htmlFor={`${id}-nome`}>
            Nome de quem assina
            <select id={`${id}-nome`} className={input} value={nameChoice} onChange={(e) => setName(e.target.value)}>
              <optgroup label="Preenchido ao emitir">
                {textFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </optgroup>
              <option value={NAME_TEXT}>Texto fixo (sempre o mesmo)</option>
              <option value={NAME_BLANK}>Em branco (escrever à mão)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700" htmlFor={`${id}-doc`}>
            CPF/CNPJ abaixo do nome
            <select
              id={`${id}-doc`}
              className={input}
              value={signer.documentKey ?? ""}
              onChange={(e) => onChange({ ...signer, documentKey: e.target.value || null })}
            >
              <option value="">Não mostrar</option>
              {documentFields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
          {signer.name.from === "text" && (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-2" htmlFor={`${id}-texto`}>
              Nome fixo
              <input
                id={`${id}-texto`}
                className={input}
                maxLength={120}
                value={signer.name.text}
                placeholder="Ex.: Clínica Exemplo Ltda"
                onChange={(e) => onChange({ ...signer, name: { from: "text", text: e.target.value } })}
              />
            </label>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-700" htmlFor={`${id}-legenda`}>
        Legenda abaixo (opcional)
        <input
          id={`${id}-legenda`}
          className={input}
          maxLength={60}
          value={signer.caption ?? ""}
          placeholder="Ex.: Cliente, Testemunha, Responsável"
          onChange={(e) => onChange({ ...signer, caption: e.target.value || null })}
        />
      </label>
    </li>
  );
}

export function SignersPanel({
  signers,
  size,
  align,
  catalog,
  onChange,
  onRemoveBlock,
}: {
  signers: Signer[];
  size: ImageSize;
  align: "left" | "center" | "right";
  catalog: CatalogVariable[];
  onChange: (patch: { signers?: Signer[]; size?: ImageSize; align?: "left" | "center" | "right" }) => void;
  onRemoveBlock: () => void;
}) {
  const meIndex = signers.findIndex((s) => s.who === "me");
  const update = (index: number, next: Signer) => onChange({ signers: signers.map((s, i) => (i === index ? next : s)) });

  return (
    <div contentEditable={false} className="mt-3 flex flex-col gap-3 rounded-xl bg-white p-3 font-sans text-sm text-slate-800 shadow-md ring-1 ring-brand-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          Assinaturas <span className="font-normal text-slate-500">({signers.length} de {MAX_SIGNERS})</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            label="Tamanho da assinatura"
            value={size}
            options={(Object.keys(IMAGE_SIZES) as ImageSize[]).map((key) => [key, IMAGE_SIZES[key].label])}
            onChange={(next) => onChange({ size: next })}
          />
          {signers.length === 1 && (
            <Toggle
              label="Posição"
              value={align}
              options={[
                ["left", "Esquerda"],
                ["center", "Centro"],
                ["right", "Direita"],
              ]}
              onChange={(next) => onChange({ align: next })}
            />
          )}
          <button type="button" onClick={onRemoveBlock} className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50">
            Remover bloco
          </button>
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {signers.map((signer, index) => (
          <SignerCard
            key={index}
            signer={signer}
            index={index}
            canRemove={signers.length > 1}
            meTaken={meIndex >= 0 && meIndex !== index}
            catalog={catalog}
            onChange={(next) => update(index, next)}
            onRemove={() => onChange({ signers: signers.filter((_, i) => i !== index) })}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {signers.length < MAX_SIGNERS ? (
          <button
            type="button"
            onClick={() => onChange({ signers: [...signers, otherSigner()] })}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50"
          >
            + Adicionar pessoa
          </button>
        ) : (
          <span className="text-xs text-slate-500">Máximo de {MAX_SIGNERS} pessoas por bloco.</span>
        )}
        <span className="text-xs text-slate-500">Para outro nome (ex.: testemunha), crie um campo em Modelos → Campos.</span>
      </div>
    </div>
  );
}
