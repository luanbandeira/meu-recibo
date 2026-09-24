"use client";

import { DEFAULT_PRESET_KEY, TEMPLATE_PRESETS, type TemplatePresetKey } from "../document/default-template";

/**
 * Galeria de modelos prontos (radio). Usada na configuração inicial e em
 * "Novo modelo". O destaque do escolhido é só CSS (has-checked), então
 * funciona igual com ou sem `onSelect`.
 */
export function PresetPicker({
  name = "modelo",
  defaultValue = DEFAULT_PRESET_KEY,
  onSelect,
}: {
  name?: string;
  defaultValue?: TemplatePresetKey;
  onSelect?: (key: TemplatePresetKey) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-slate-800">Escolha um modelo para começar</legend>
      {TEMPLATE_PRESETS.map((preset) => (
        <label
          key={preset.key}
          className="flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 has-checked:bg-brand-50 has-checked:ring-brand-300"
        >
          <input
            type="radio"
            name={name}
            value={preset.key}
            defaultChecked={preset.key === defaultValue}
            onChange={() => onSelect?.(preset.key)}
            className="mt-1 size-4 shrink-0 accent-brand-600"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{preset.title}</span>
            <span className="block text-xs text-slate-600">{preset.audience}</span>
            <span className="mt-1.5 block rounded-lg bg-white/70 px-2.5 py-2 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
              {preset.preview}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
