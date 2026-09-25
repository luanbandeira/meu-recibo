import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import {
  A4,
  FONT_KEYS,
  FONT_SIZES,
  IMAGE_SIZES,
  LINE_HEIGHTS,
  MARGINS,
  PARAGRAPH_SPACING_PT,
  type FontKey,
  type HeaderLayout,
  type ImageSize,
  type TemplateSettings,
} from "@/features/templates/document/constants";
import { headerLines, signatureDocumentLine, type DocumentProfile } from "@/features/templates/document/profile-values";
import {
  effectiveMeMode,
  signatureRows,
  signersOf,
  type SignatureMode,
  type Signer,
} from "@/features/templates/document/signatures";

/**
 * O recibo em PDF. Espelha o renderizador HTML da prévia/editor: mesmos
 * nós, mesmas medidas em pt, mesmas fontes. Só nós conhecidos são desenhados.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: Mark[] };

export type PdfImage = { data: Buffer; format: "png" | "jpg"; width: number; height: number };

export type ReceiptDocumentProps = {
  content: { content?: unknown[] };
  settings: TemplateSettings;
  profile: DocumentProfile;
  images: { logo: PdfImage | null; signature: PdfImage | null };
  resolve: (key: string, format?: "short" | "long" | null) => string;
  /** Escolha feita na emissão para a SUA assinatura (digital ou à mão). */
  signatureMode: SignatureMode;
  title: string;
};

const TEXT_COLOR = "#111827";
const ALIGNS = new Set(["left", "center", "right", "justify"]);
type Align = "left" | "center" | "right" | "justify";

function markStyle(marks: Mark[] | undefined) {
  const style: Record<string, string | number> = {};
  for (const mark of marks ?? []) {
    if (mark.type === "bold") style.fontWeight = 700;
    if (mark.type === "italic") style.fontStyle = "italic";
    if (mark.type === "underline") style.textDecoration = "underline";
    if (mark.type === "textStyle") {
      const font = mark.attrs?.fontFamily;
      const size = mark.attrs?.fontSize;
      if (typeof font === "string" && (FONT_KEYS as string[]).includes(font)) style.fontFamily = font;
      if ((FONT_SIZES as readonly unknown[]).includes(size)) style.fontSize = size as number;
    }
  }
  return style;
}

function blockStyle(attrs: Record<string, unknown> | undefined) {
  const style: Record<string, string | number> = {};
  if (typeof attrs?.textAlign === "string" && ALIGNS.has(attrs.textAlign)) style.textAlign = attrs.textAlign as Align;
  if ((LINE_HEIGHTS as readonly unknown[]).includes(attrs?.lineHeight)) style.lineHeight = attrs!.lineHeight as number;
  return style;
}

function inlines(nodes: Node[] | undefined, resolve: ReceiptDocumentProps["resolve"]): ReactNode[] {
  return (nodes ?? []).map((node, i) => {
    if (node.type === "text") return <Text key={i} style={markStyle(node.marks)}>{node.text ?? ""}</Text>;
    if (node.type === "hardBreak") return <Text key={i}>{"\n"}</Text>;
    if (node.type === "variable") {
      const format = node.attrs?.format === "long" ? "long" : node.attrs?.format === "short" ? "short" : null;
      return (
        <Text key={i} style={markStyle(node.marks)}>
          {resolve(String(node.attrs?.key ?? ""), format)}
        </Text>
      );
    }
    return null;
  });
}

const justify = { left: "flex-start", center: "center", right: "flex-end" } as const;

function fit(image: PdfImage, opts: { height?: number; width?: number; maxWidth?: number }) {
  const ratio = image.width / image.height;
  let width = opts.width ?? (opts.height ?? 0) * ratio;
  let height = opts.height ?? (opts.width ?? 0) / ratio;
  if (opts.maxWidth && width > opts.maxWidth) {
    width = opts.maxWidth;
    height = width / ratio;
  }
  return { width, height };
}

function Header({ layout, profile, logo, contentWidth }: { layout: HeaderLayout; profile: DocumentProfile; logo: PdfImage | null; contentWidth: number }) {
  const lines = headerLines(profile);
  const showLogo = layout !== "no-logo" && logo;
  const logoSize = showLogo ? fit(logo, { height: IMAGE_SIZES.medium.logoPt, maxWidth: contentWidth * 0.35 }) : null;
  const row = layout === "logo-left";

  return (
    <View style={{ flexDirection: row ? "row" : "column", alignItems: "center", marginVertical: 4 }}>
      {showLogo && logoSize && (
        // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf, não é <img>
        <Image src={{ data: logo.data, format: logo.format }} style={{ ...logoSize, marginRight: row ? 16 : 0, marginBottom: row ? 0 : 8 }} />
      )}
      <View style={{ flexShrink: 1, alignItems: row ? "flex-start" : "center" }}>
        <Text style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{lines.name}</Text>
        {lines.company && <Text style={{ fontSize: 10, lineHeight: 1.4 }}>{lines.company}</Text>}
        {lines.professionLine && <Text style={{ fontSize: 10.5, lineHeight: 1.4 }}>{lines.professionLine}</Text>}
        {lines.contactLine && <Text style={{ fontSize: 10.5, lineHeight: 1.4 }}>{lines.contactLine}</Text>}
      </View>
    </View>
  );
}

const SIGN_SPACE_PT = 40; // altura livre para assinar à mão
const SIGNATURE_GAP_PT = 24;

/** Texto sob a linha de cada pessoa: nome, registro/documento e legenda. */
function signerLines(signer: Signer, profile: DocumentProfile, resolve: ReceiptDocumentProps["resolve"]) {
  if (signer.who === "me") {
    const lines = headerLines(profile);
    return {
      name: signer.showName ? lines.name : null,
      detail: signer.showName ? signatureDocumentLine(profile) : null,
      caption: signer.caption,
    };
  }
  const name =
    signer.name.from === "field" ? resolve(signer.name.key) : signer.name.from === "text" ? signer.name.text : null;
  const document = signer.documentKey ? resolve(signer.documentKey) : "";
  return { name: name || null, detail: document ? `CPF/CNPJ: ${document}` : null, caption: signer.caption };
}

function SignatureBlock({
  attrs,
  props,
  contentWidth,
}: {
  attrs: Record<string, unknown> | undefined;
  props: ReceiptDocumentProps;
  contentWidth: number;
}) {
  const size = (attrs?.size as ImageSize) in IMAGE_SIZES ? (attrs?.size as ImageSize) : "medium";
  const align = (attrs?.align as keyof typeof justify) in justify ? (attrs?.align as keyof typeof justify) : "center";
  const signers = signersOf(attrs);
  const image = props.images.signature;
  const rows = signatureRows(signers);
  const perRow = rows[0].length;
  const columnWidth = Math.min(IMAGE_SIZES[size].signaturePt + 60, (contentWidth - SIGNATURE_GAP_PT * (perRow - 1)) / perRow);
  const imageSize = image ? fit(image, { width: Math.min(IMAGE_SIZES[size].signaturePt, columnWidth) }) : null;
  const isDigital = (signer: Signer) =>
    signer.who === "me" && effectiveMeMode(signer, props.signatureMode, Boolean(image)) === "digital";

  return (
    // wrap={false}: o bloco de assinaturas nunca é dividido entre páginas.
    <View wrap={false} style={{ marginVertical: 12 }}>
      {rows.map((row, r) => {
        const rowArea = Math.max(SIGN_SPACE_PT, ...row.map((signer) => (isDigital(signer) && imageSize ? imageSize.height : 0)));
        return (
          <View
            key={r}
            style={{
              flexDirection: "row",
              justifyContent: signers.length === 1 ? justify[align] : "space-around",
              marginTop: r > 0 ? 20 : 0,
            }}
          >
            {row.map((signer, i) => {
              const digital = isDigital(signer);
              const text = signerLines(signer, props.profile, props.resolve);
              // Sem nada abaixo e assinatura digital: só a imagem (como sempre foi).
              const showLine = !digital || Boolean(text.name || text.detail || text.caption);
              return (
                <View key={i} style={{ width: columnWidth, alignItems: "center" }}>
                  {/* Mesma altura para todos da linha: as linhas de assinatura ficam alinhadas. */}
                  <View style={{ height: rowArea, width: "100%", alignItems: "center", justifyContent: "flex-end" }}>
                    {digital && image && imageSize && (
                      // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf, não é <img>
                      <Image src={{ data: image.data, format: image.format }} style={imageSize} />
                    )}
                  </View>
                  {showLine && (
                    <View style={{ width: "100%", borderTopWidth: 0.75, borderTopColor: "#1f2937", paddingTop: 2, marginTop: 2, alignItems: "center" }}>
                      {text.name && <Text style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.3, textAlign: "center" }}>{text.name}</Text>}
                      {text.detail && <Text style={{ fontSize: 10, lineHeight: 1.3, textAlign: "center" }}>{text.detail}</Text>}
                      {text.caption && <Text style={{ fontSize: 9, lineHeight: 1.3, textAlign: "center", color: "#4b5563" }}>{text.caption}</Text>}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function Blocks({ nodes, props, contentWidth }: { nodes: Node[]; props: ReceiptDocumentProps; contentWidth: number }): ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "paragraph":
        return (
          <Text key={i} style={{ marginBottom: PARAGRAPH_SPACING_PT, ...blockStyle(node.attrs) }}>
            {node.content?.length ? inlines(node.content, props.resolve) : " "}
          </Text>
        );
      case "heading": {
        const size = node.attrs?.level === 1 ? 20 : node.attrs?.level === 2 ? 16 : 14;
        return (
          <Text key={i} style={{ fontSize: size, fontWeight: 700, marginBottom: PARAGRAPH_SPACING_PT, ...blockStyle(node.attrs) }}>
            {inlines(node.content, props.resolve)}
          </Text>
        );
      }
      case "bulletList":
      case "orderedList":
        return (
          <View key={i} style={{ marginBottom: PARAGRAPH_SPACING_PT }}>
            {(node.content ?? []).map((item, j) => (
              <View key={j} style={{ flexDirection: "row" }}>
                <Text style={{ width: 20 }}>{node.type === "bulletList" ? "•" : `${j + Number(node.attrs?.start ?? 1)}.`}</Text>
                <View style={{ flex: 1 }}>
                  <Blocks nodes={item.content ?? []} props={props} contentWidth={contentWidth - 20} />
                </View>
              </View>
            ))}
          </View>
        );
      case "horizontalRule":
        return <View key={i} style={{ borderBottomWidth: 0.75, borderBottomColor: "#374151", marginVertical: PARAGRAPH_SPACING_PT }} />;
      case "professionalHeader":
        return <Header key={i} layout={(node.attrs?.layout as HeaderLayout) ?? "logo-left"} profile={props.profile} logo={props.images.logo} contentWidth={contentWidth} />;
      case "logo": {
        const logo = props.images.logo;
        if (!logo) return null;
        const size = (node.attrs?.size as ImageSize) in IMAGE_SIZES ? (node.attrs?.size as ImageSize) : "medium";
        const align = (node.attrs?.align as keyof typeof justify) in justify ? (node.attrs?.align as keyof typeof justify) : "left";
        return (
          <View key={i} style={{ flexDirection: "row", justifyContent: justify[align], marginVertical: 4 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf, não é <img> */}
            <Image src={{ data: logo.data, format: logo.format }} style={fit(logo, { height: IMAGE_SIZES[size].logoPt, maxWidth: contentWidth })} />
          </View>
        );
      }
      case "signature":
        return <SignatureBlock key={i} attrs={node.attrs} props={props} contentWidth={contentWidth} />;
      default:
        return null;
    }
  });
}

export function ReceiptDocument(props: ReceiptDocumentProps) {
  const margin = MARGINS[props.settings.margins]?.pt ?? MARGINS.normal.pt;
  const contentWidth = A4.widthPt - margin * 2;
  const nodes = (props.content.content ?? []) as Node[];
  // Parágrafo vazio no fim (inserido pelo editor) não deve empurrar a assinatura.
  const last = nodes[nodes.length - 1];
  const trimmed = last?.type === "paragraph" && !last.content?.length ? nodes.slice(0, -1) : nodes;

  return (
    <Document title={props.title} author={props.profile.full_name} creator="MeuRecibo" producer="MeuRecibo" language="pt-BR">
      <Page
        size="A4"
        style={{
          padding: margin,
          fontFamily: props.settings.fontFamily as FontKey,
          fontSize: props.settings.fontSize,
          lineHeight: props.settings.lineHeight,
          color: TEXT_COLOR,
        }}
      >
        <Blocks nodes={trimmed} props={props} contentWidth={contentWidth} />
      </Page>
    </Document>
  );
}
