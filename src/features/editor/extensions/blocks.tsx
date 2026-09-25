"use client";

import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import type { ComponentType, ReactNode } from "react";
import {
  HEADER_LAYOUTS,
  IMAGE_SIZES,
  type HeaderLayout,
  type ImageSize,
} from "@/features/templates/document/constants";
import {
  HeaderBlockView,
  LogoBlockView,
  SignatureBlockView,
  type BlockAlign,
} from "@/features/templates/document/blocks-view";
import { DEFAULT_NEW_SIGNERS, signersOf } from "@/features/templates/document/signatures";
import { SignersPanel } from "../components/signers-panel";
import { useEditorData } from "../editor-context";

// Blocos especiais: sem posicionamento livre — só opções fechadas
// (layout, tamanho, alinhamento), iguais às do PDF.

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    documentBlocks: {
      insertBlock: (type: "professionalHeader" | "logo" | "signature") => ReturnType;
    };
  }
}


function BlockControls({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div
      contentEditable={false}
      className="absolute -top-2 right-0 z-10 flex -translate-y-full flex-wrap items-center gap-1 rounded-lg bg-white p-1 font-sans text-xs text-slate-800 shadow-md ring-1 ring-slate-200"
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
      <button type="button" onClick={onRemove} className="rounded px-2 py-1 text-red-700 hover:bg-red-50">
        Remover
      </button>
    </div>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md ring-1 ring-slate-200">
      {(Object.keys(options) as T[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`whitespace-nowrap px-2 py-1 first:rounded-l-md last:rounded-r-md ${value === key ? "bg-brand-600 text-white" : "hover:bg-slate-100"}`}
        >
          {options[key]}
        </button>
      ))}
    </div>
  );
}

const sizeOptions = Object.fromEntries(Object.entries(IMAGE_SIZES).map(([k, v]) => [k, v.label])) as Record<ImageSize, string>;
const alignOptions: Record<BlockAlign, string> = { left: "Esquerda", center: "Centro", right: "Direita" };

// ---------------------------------------------------------------------------

function HeaderView({ node, selected: isSelected, editor, updateAttributes, deleteNode }: ReactNodeViewProps) {
  // Somente leitura (modo suporte): sem destaque nem controles de edição.
  const selected = isSelected && editor.isEditable;
  const { profile, assets } = useEditorData();
  const layout = node.attrs.layout as HeaderLayout;
  return (
    <NodeViewWrapper
      className={`relative my-[calc(4*var(--pt))] rounded ${selected ? "outline-2 outline-offset-4 outline-brand-600" : "hover:outline-1 hover:outline-offset-4 hover:outline-slate-300"}`}
    >
      {selected && (
        <BlockControls onRemove={deleteNode}>
          <Choice value={layout} options={HEADER_LAYOUTS} onChange={(v) => updateAttributes({ layout: v })} />
        </BlockControls>
      )}
      <div contentEditable={false}>
        <HeaderBlockView layout={layout} profile={profile} assets={assets} />
      </div>
    </NodeViewWrapper>
  );
}

function LogoView({ node, selected: isSelected, editor, updateAttributes, deleteNode }: ReactNodeViewProps) {
  // Somente leitura (modo suporte): sem destaque nem controles de edição.
  const selected = isSelected && editor.isEditable;
  const { assets } = useEditorData();
  const size = node.attrs.size as ImageSize;
  const align = node.attrs.align as BlockAlign;
  return (
    <NodeViewWrapper className={`relative my-[calc(4*var(--pt))] ${selected ? "outline-2 outline-offset-4 outline-brand-600" : ""}`}>
      {selected && (
        <BlockControls onRemove={deleteNode}>
          <Choice value={size} options={sizeOptions} onChange={(v) => updateAttributes({ size: v })} />
          <Choice value={align} options={alignOptions} onChange={(v) => updateAttributes({ align: v })} />
        </BlockControls>
      )}
      <div contentEditable={false}>
        <LogoBlockView size={size} align={align} assets={assets} />
      </div>
    </NodeViewWrapper>
  );
}

function SignatureView({ node, selected: isSelected, editor, updateAttributes, deleteNode }: ReactNodeViewProps) {
  // Somente leitura (modo suporte): sem destaque nem painel de edição.
  const selected = isSelected && editor.isEditable;
  const { assets, profile, catalog, fieldLabels } = useEditorData();
  const size = node.attrs.size as ImageSize;
  const align = node.attrs.align as BlockAlign;
  // Bloco antigo (sem lista) = só você, digital; vira lista explícita na primeira edição.
  const signers = signersOf(node.attrs);
  return (
    <NodeViewWrapper className={`relative my-[calc(12*var(--pt))] rounded ${selected ? "outline-2 outline-offset-4 outline-brand-600" : "hover:outline-1 hover:outline-offset-4 hover:outline-slate-300"}`}>
      <div contentEditable={false}>
        <SignatureBlockView size={size} align={align} signers={signers} profile={profile} assets={assets} fieldLabels={fieldLabels} />
      </div>
      {selected && (
        <SignersPanel
          signers={signers}
          size={size}
          align={align}
          catalog={catalog}
          onChange={(patch) => updateAttributes(patch)}
          onRemoveBlock={deleteNode}
        />
      )}
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------

function atomBlock(name: string, attrs: Record<string, unknown>, view: ComponentType<ReactNodeViewProps>) {
  return Node.create({
    name,
    group: "block",
    atom: true,
    selectable: true,
    draggable: false,
    addAttributes() {
      return Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key, { default: value }]));
    },
    parseHTML() {
      return [{ tag: `div[data-block="${name}"]` }];
    },
    renderHTML() {
      return ["div", { "data-block": name }];
    },
    addNodeView() {
      return ReactNodeViewRenderer(view);
    },
  });
}

export const ProfessionalHeader = atomBlock("professionalHeader", { layout: "logo-left" }, HeaderView);
export const LogoBlock = atomBlock("logo", { align: "left", size: "medium" }, LogoView);
// signers: null = bloco antigo (só você). Blocos novos já nascem com 2 pessoas.
export const SignatureBlock = atomBlock("signature", { align: "center", size: "medium", showName: true, signers: null }, SignatureView).extend({
  addCommands() {
    return {
      insertBlock:
        (type) =>
        ({ commands }) =>
          commands.insertContent(type === "signature" ? { type, attrs: { signers: DEFAULT_NEW_SIGNERS } } : { type }),
    };
  },
});
