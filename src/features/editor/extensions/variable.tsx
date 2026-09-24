"use client";

import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { VARIABLE_KEY_PATTERN } from "@/features/templates/document/variables";
import { useEditorData } from "../editor-context";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (key: string, format?: "short" | "long" | null) => ReturnType;
    };
  }
}

function VariableChip({ node, selected: isSelected, editor, updateAttributes }: ReactNodeViewProps) {
  const selected = isSelected && editor.isEditable;
  const { catalog, fieldLabels } = useEditorData();
  const key = node.attrs.key as string;
  const entry = catalog.find((v) => v.key === key);
  const archivedLabel = !entry ? fieldLabels[key] : undefined;
  const isDate = entry?.type === "date";
  const tone = archivedLabel
    ? "bg-slate-100 text-slate-700 ring-slate-300"
    : !entry
    ? "bg-red-50 text-red-800 ring-red-300"
    : entry.group === "fields"
      ? "bg-brand-50 text-brand-800 ring-brand-200"
      : "bg-emerald-50 text-emerald-800 ring-emerald-200";

  return (
    <NodeViewWrapper
      as="span"
      className={`relative mx-px inline-flex items-baseline rounded px-1 ring-1 ring-inset ${tone} ${selected ? "outline-2 outline-brand-600" : ""}`}
      style={{ fontSize: "0.92em" }}
      title={entry ? `Variável: ${entry.label}` : archivedLabel ? `Campo arquivado: ${archivedLabel}` : `Campo "${key}" não existe mais`}
      data-variable={key}
    >
      {entry?.label ?? (archivedLabel ? `${archivedLabel} (arquivado)` : `${key} (removido)`)}
      {isDate && node.attrs.format === "long" && <span className="ml-1 opacity-70">(por extenso)</span>}
      {selected && isDate && (
        <span contentEditable={false} className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-md bg-white p-1 text-xs shadow-md ring-1 ring-slate-200">
          {(["short", "long"] as const).map((format) => (
            <button
              key={format}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ format })}
              className={`whitespace-nowrap rounded px-2 py-1 ${node.attrs.format === format || (!node.attrs.format && format === "short") ? "bg-brand-600 text-white" : "hover:bg-slate-100"}`}
            >
              {format === "short" ? "23/09/2026" : "23 de setembro de 2026"}
            </button>
          ))}
        </span>
      )}
    </NodeViewWrapper>
  );
}

export const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      key: { default: null, parseHTML: (el) => el.getAttribute("data-variable") },
      format: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },

  // Ao copiar para fora do editor, vira o texto {{chave}}.
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-variable": node.attrs.key }), `{{${node.attrs.key}}}`];
  },

  renderText({ node }) {
    return `{{${node.attrs.key}}}`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChip, { as: "span" });
  },

  addCommands() {
    return {
      insertVariable:
        (key, format) =>
        ({ commands }) =>
          commands.insertContent([
            { type: this.name, attrs: { key, format: format ?? null } },
            { type: "text", text: " " },
          ]),
    };
  },

  // Digitar {{chave}} vira a variável correspondente.
  addInputRules() {
    return [
      new InputRule({
        find: /\{\{([a-z][a-z0-9_]{1,39})\}\}$/,
        handler: ({ state, range, match }) => {
          const key = match[1];
          if (!VARIABLE_KEY_PATTERN.test(key)) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create({ key }));
        },
      }),
    ];
  },
});
