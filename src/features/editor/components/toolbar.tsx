"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import type { ReactNode } from "react";
import { FONTS, FONT_KEYS, FONT_SIZES, LINE_HEIGHTS, type FontKey } from "@/features/templates/document/constants";
import { Icons } from "./icons";

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Mantém a seleção do texto ao clicar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-sm transition-colors disabled:opacity-40 ${
        active ? "bg-brand-100 text-brand-800" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function LabeledButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap text-slate-700 hover:bg-slate-100"
    >
      {children}
      {label}
    </button>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-slate-200" />;

const selectClass =
  "h-10 shrink-0 rounded-lg bg-white px-2 text-sm text-slate-800 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600";

export function Toolbar({
  editor,
  onOpenVariables,
  onTogglePage,
  pageOpen,
}: {
  editor: Editor;
  onOpenVariables: () => void;
  onTogglePage: () => void;
  pageOpen: boolean;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      align: (["left", "center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      fontFamily: (e.getAttributes("textStyle").fontFamily as string | null) ?? "",
      fontSize: (e.getAttributes("textStyle").fontSize as number | null) ?? "",
      lineHeight: (e.getAttributes("paragraph").lineHeight as number | null) ?? "",
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatação" className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5">
      <ToolButton label="Desfazer (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Icons.undo />
      </ToolButton>
      <ToolButton label="Refazer (Ctrl+Y)" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Icons.redo />
      </ToolButton>
      <Divider />

      <label className="sr-only" htmlFor="tb-font">Fonte</label>
      <select
        id="tb-font"
        className={`${selectClass} w-40`}
        value={state.fontFamily}
        onChange={(e) => chain().setFontFamily((e.target.value || null) as FontKey | null).run()}
      >
        <option value="">Fonte do modelo</option>
        {FONT_KEYS.map((key) => (
          <option key={key} value={key}>{FONTS[key].label}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="tb-size">Tamanho</label>
      <select
        id="tb-size"
        className={`${selectClass} ml-1 w-20`}
        value={state.fontSize}
        onChange={(e) => chain().setFontSize(e.target.value ? Number(e.target.value) : null).run()}
      >
        <option value="">Padrão</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
      <Divider />

      <ToolButton label="Negrito (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <span className="font-bold">N</span>
      </ToolButton>
      <ToolButton label="Itálico (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <span className="font-serif italic">I</span>
      </ToolButton>
      <ToolButton label="Sublinhado (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <span className="underline">S</span>
      </ToolButton>
      <Divider />

      <ToolButton label="Alinhar à esquerda" active={state.align === "left"} onClick={() => chain().setTextAlign("left").run()}>
        <Icons.alignLeft />
      </ToolButton>
      <ToolButton label="Centralizar" active={state.align === "center"} onClick={() => chain().setTextAlign("center").run()}>
        <Icons.alignCenter />
      </ToolButton>
      <ToolButton label="Alinhar à direita" active={state.align === "right"} onClick={() => chain().setTextAlign("right").run()}>
        <Icons.alignRight />
      </ToolButton>
      <ToolButton label="Justificar" active={state.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}>
        <Icons.alignJustify />
      </ToolButton>
      <Divider />

      <ToolButton label="Lista com marcadores" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
        <Icons.bulletList />
      </ToolButton>
      <ToolButton label="Lista numerada" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
        <Icons.orderedList />
      </ToolButton>
      <label className="sr-only" htmlFor="tb-spacing">Espaçamento entre linhas</label>
      <select
        id="tb-spacing"
        title="Espaçamento entre linhas"
        className={`${selectClass} ml-1 w-24`}
        value={state.lineHeight}
        onChange={(e) => chain().setLineHeight(e.target.value ? Number(e.target.value) : null).run()}
      >
        <option value="">Espaço</option>
        {LINE_HEIGHTS.map((v) => (
          <option key={v} value={v}>{String(v).replace(".", ",")}</option>
        ))}
      </select>
      <Divider />

      <LabeledButton label="Variável" onClick={onOpenVariables}>
        <Icons.variable />
      </LabeledButton>
      <LabeledButton label="Cabeçalho" onClick={() => chain().insertBlock("professionalHeader").run()}>
        <Icons.header />
      </LabeledButton>
      <LabeledButton label="Logo" onClick={() => chain().insertBlock("logo").run()}>
        <Icons.image />
      </LabeledButton>
      <LabeledButton label="Assinatura" onClick={() => chain().insertBlock("signature").run()}>
        <Icons.signature />
      </LabeledButton>
      <LabeledButton label="Linha" onClick={() => chain().setHorizontalRule().run()}>
        <Icons.line />
      </LabeledButton>
      <Divider />
      <button
        type="button"
        onClick={onTogglePage}
        aria-expanded={pageOpen}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap ${pageOpen ? "bg-brand-100 text-brand-800" : "text-slate-700 hover:bg-slate-100"}`}
      >
        <Icons.page />
        Página
      </button>
    </div>
  );
}
