"use client";

/* eslint-disable @next/next/no-img-element -- imagens privadas com URL assinada temporária */

import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import type { ComponentType, ReactNode } from "react";
import {
  HEADER_LAYOUTS,
  IMAGE_SIZES,
  type HeaderLayout,
  type ImageSize,
} from "@/features/templates/document/constants";
import { headerLines } from "@/features/templates/document/profile-values";
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

const alignClass = { left: "justify-start", center: "justify-center", right: "justify-end" } as const;
type Align = keyof typeof alignClass;

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
const alignOptions: Record<Align, string> = { left: "Esquerda", center: "Centro", right: "Direita" };

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-dashed border-slate-300 px-3 py-2 font-sans text-[0.8em] text-slate-500">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------

function HeaderView({ node, selected, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const { profile, assets } = useEditorData();
  const layout = node.attrs.layout as HeaderLayout;
  const lines = headerLines(profile);
  const showLogo = layout !== "no-logo";

  const logo = showLogo ? (
    assets.logoUrl ? (
      <img src={assets.logoUrl} alt="" style={{ height: `calc(${IMAGE_SIZES.medium.logoPt} * var(--pt))` }} className="w-auto max-w-[35%] object-contain" />
    ) : (
      <Placeholder>Sua logo</Placeholder>
    )
  ) : null;

  const text = (
    <div className={layout === "logo-left" ? "text-left" : "text-center"}>
      <div style={{ fontSize: "calc(18 * var(--pt))" }} className="font-bold leading-tight">
        {lines.name}
      </div>
      {lines.company && <div style={{ fontSize: "calc(10 * var(--pt))" }}>{lines.company}</div>}
      {lines.professionLine && <div style={{ fontSize: "calc(10.5 * var(--pt))" }}>{lines.professionLine}</div>}
      {lines.contactLine && <div style={{ fontSize: "calc(10.5 * var(--pt))" }}>{lines.contactLine}</div>}
    </div>
  );

  return (
    <NodeViewWrapper
      className={`relative my-[calc(4*var(--pt))] rounded ${selected ? "outline-2 outline-offset-4 outline-brand-600" : "hover:outline-1 hover:outline-offset-4 hover:outline-slate-300"}`}
      data-drag-handle=""
    >
      {selected && (
        <BlockControls onRemove={deleteNode}>
          <Choice value={layout} options={HEADER_LAYOUTS} onChange={(v) => updateAttributes({ layout: v })} />
        </BlockControls>
      )}
      <div contentEditable={false} className={layout === "logo-left" ? "flex items-center gap-[calc(16*var(--pt))]" : "flex flex-col items-center gap-[calc(8*var(--pt))]"}>
        {logo}
        {text}
      </div>
    </NodeViewWrapper>
  );
}

function LogoView({ node, selected, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const { assets } = useEditorData();
  const size = node.attrs.size as ImageSize;
  const align = node.attrs.align as Align;

  return (
    <NodeViewWrapper className={`relative my-[calc(4*var(--pt))] flex ${alignClass[align]} ${selected ? "outline-2 outline-offset-4 outline-brand-600" : ""}`}>
      {selected && (
        <BlockControls onRemove={deleteNode}>
          <Choice value={size} options={sizeOptions} onChange={(v) => updateAttributes({ size: v })} />
          <Choice value={align} options={alignOptions} onChange={(v) => updateAttributes({ align: v })} />
        </BlockControls>
      )}
      <div contentEditable={false}>
        {assets.logoUrl ? (
          <img src={assets.logoUrl} alt="Logo" style={{ height: `calc(${IMAGE_SIZES[size].logoPt} * var(--pt))` }} className="w-auto object-contain" />
        ) : (
          <Placeholder>Logo (envie em Perfil)</Placeholder>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function SignatureView({ node, selected, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const { assets, profile } = useEditorData();
  const size = node.attrs.size as ImageSize;
  const align = node.attrs.align as Align;
  const showName = Boolean(node.attrs.showName);
  const lines = headerLines(profile);

  return (
    <NodeViewWrapper className={`relative my-[calc(12*var(--pt))] flex ${alignClass[align]} ${selected ? "outline-2 outline-offset-4 outline-brand-600" : ""}`}>
      {selected && (
        <BlockControls onRemove={deleteNode}>
          <Choice value={size} options={sizeOptions} onChange={(v) => updateAttributes({ size: v })} />
          <Choice value={align} options={alignOptions} onChange={(v) => updateAttributes({ align: v })} />
          <label className="flex items-center gap-1 px-1">
            <input type="checkbox" checked={showName} onChange={(e) => updateAttributes({ showName: e.target.checked })} />
            Nome abaixo
          </label>
        </BlockControls>
      )}
      <div contentEditable={false} className="flex flex-col items-center" style={{ width: `calc(${IMAGE_SIZES[size].signaturePt + 60} * var(--pt))` }}>
        {assets.signatureUrl ? (
          <img src={assets.signatureUrl} alt="Assinatura" style={{ width: `calc(${IMAGE_SIZES[size].signaturePt} * var(--pt))` }} className="h-auto object-contain" />
        ) : (
          <Placeholder>Assinatura e carimbo (envie em Perfil)</Placeholder>
        )}
        {showName && (
          <div className="mt-[calc(2*var(--pt))] w-full border-t border-slate-800 pt-[calc(2*var(--pt))] text-center" style={{ fontSize: "calc(10 * var(--pt))" }}>
            <div className="font-semibold">{lines.name}</div>
            {lines.professionLine && <div>{lines.professionLine}</div>}
          </div>
        )}
      </div>
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
export const SignatureBlock = atomBlock("signature", { align: "center", size: "medium", showName: true }, SignatureView).extend({
  addCommands() {
    return {
      insertBlock:
        (type) =>
        ({ commands }) =>
          commands.insertContent({ type }),
    };
  },
});
