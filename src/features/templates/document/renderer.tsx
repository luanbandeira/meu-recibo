import type { CSSProperties, ReactNode } from "react";
import { HeaderBlockView, LogoBlockView, SignatureBlockView, type BlockAlign, type DocumentAssets } from "./blocks-view";
import { FONTS, FONT_SIZES, LINE_HEIGHTS, type FontKey, type HeaderLayout, type ImageSize } from "./constants";
import type { DocumentProfile } from "./profile-values";

/**
 * Renderiza o JSON do modelo como React, substituindo variáveis.
 * Nenhum HTML é interpretado: cada tipo de nó conhecido vira um elemento;
 * texto é sempre filho React (escapado); estilos vêm só de listas fechadas.
 * Nós desconhecidos são ignorados.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: Mark[] };

export type VariableResolver = (key: string, format?: "short" | "long" | null) => { text: string; missing: boolean };

type Context = {
  resolve: VariableResolver;
  profile: DocumentProfile;
  assets: DocumentAssets;
  /** Destaca variáveis vazias (só na prévia, nunca no PDF). */
  highlightMissing: boolean;
  labelFor?: (key: string) => string;
};

const ALIGNS = new Set(["left", "center", "right", "justify"]);

function blockStyle(attrs?: Record<string, unknown>): CSSProperties {
  const style: CSSProperties = {};
  if (typeof attrs?.textAlign === "string" && ALIGNS.has(attrs.textAlign)) {
    style.textAlign = attrs.textAlign as CSSProperties["textAlign"];
  }
  if ((LINE_HEIGHTS as readonly unknown[]).includes(attrs?.lineHeight)) style.lineHeight = attrs!.lineHeight as number;
  return style;
}

function applyMarks(content: ReactNode, marks: Mark[] | undefined, key: string | number): ReactNode {
  let result = content;
  for (const mark of marks ?? []) {
    if (mark.type === "bold") result = <strong>{result}</strong>;
    else if (mark.type === "italic") result = <em>{result}</em>;
    else if (mark.type === "underline") result = <u>{result}</u>;
    else if (mark.type === "textStyle") {
      const style: CSSProperties = {};
      const font = mark.attrs?.fontFamily;
      const size = mark.attrs?.fontSize;
      if (typeof font === "string" && font in FONTS) style.fontFamily = FONTS[font as FontKey].css;
      if ((FONT_SIZES as readonly unknown[]).includes(size)) style.fontSize = `calc(${size} * var(--pt))`;
      result = <span style={style}>{result}</span>;
    }
  }
  return <span key={key}>{result}</span>;
}

function renderInline(node: Node, index: number, ctx: Context): ReactNode {
  if (node.type === "text") return applyMarks(node.text ?? "", node.marks, index);
  if (node.type === "hardBreak") return <br key={index} />;
  if (node.type === "variable") {
    const key = String(node.attrs?.key ?? "");
    const format = node.attrs?.format === "long" ? "long" : node.attrs?.format === "short" ? "short" : null;
    const { text, missing } = ctx.resolve(key, format);
    const content =
      missing && ctx.highlightMissing ? (
        <span className="rounded bg-amber-100 px-0.5 text-amber-900" title="Não preenchido — não aparece no PDF">
          [{ctx.labelFor?.(key) ?? key}]
        </span>
      ) : (
        text
      );
    return applyMarks(content, node.marks, index);
  }
  return null;
}

function renderBlock(node: Node, index: number, ctx: Context): ReactNode {
  const children = () => node.content?.map((child, i) => renderInline(child, i, ctx));
  switch (node.type) {
    case "paragraph":
      return (
        <p key={index} style={blockStyle(node.attrs)}>
          {node.content?.length ? children() : <br />}
        </p>
      );
    case "heading": {
      const level = node.attrs?.level === 1 ? "h1" : node.attrs?.level === 2 ? "h2" : "h3";
      const Tag = level;
      return (
        <Tag key={index} style={blockStyle(node.attrs)}>
          {children()}
        </Tag>
      );
    }
    case "bulletList":
    case "orderedList": {
      const List = node.type === "bulletList" ? "ul" : "ol";
      return (
        <List key={index}>
          {node.content?.map((item, i) => (
            <li key={i}>{item.content?.map((child, j) => renderBlock(child, j, ctx))}</li>
          ))}
        </List>
      );
    }
    case "horizontalRule":
      return <hr key={index} />;
    case "professionalHeader":
      return (
        <div key={index} className="my-[calc(4*var(--pt))]">
          <HeaderBlockView layout={(node.attrs?.layout as HeaderLayout) ?? "logo-left"} profile={ctx.profile} assets={ctx.assets} showPlaceholders={ctx.highlightMissing} />
        </div>
      );
    case "logo":
      return (
        <div key={index} className="my-[calc(4*var(--pt))]">
          <LogoBlockView size={(node.attrs?.size as ImageSize) ?? "medium"} align={(node.attrs?.align as BlockAlign) ?? "left"} assets={ctx.assets} showPlaceholders={ctx.highlightMissing} />
        </div>
      );
    case "signature":
      return (
        <div key={index} className="my-[calc(12*var(--pt))]">
          <SignatureBlockView
            size={(node.attrs?.size as ImageSize) ?? "medium"}
            align={(node.attrs?.align as BlockAlign) ?? "center"}
            showName={Boolean(node.attrs?.showName)}
            profile={ctx.profile}
            assets={ctx.assets}
            showPlaceholders={ctx.highlightMissing}
          />
        </div>
      );
    default:
      return null;
  }
}

export function DocumentContent({
  doc,
  ...ctx
}: { doc: { content?: unknown[] } } & Context) {
  const nodes = (doc.content ?? []) as Node[];
  // Parágrafo vazio no fim (inserido pelo editor) não deve empurrar a assinatura.
  const trimmed = nodes.length && nodes[nodes.length - 1].type === "paragraph" && !nodes[nodes.length - 1].content?.length ? nodes.slice(0, -1) : nodes;
  return <div className="doc-content">{trimmed.map((node, i) => renderBlock(node, i, ctx))}</div>;
}
