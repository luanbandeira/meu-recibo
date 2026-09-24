// Tudo em pontos (pt), a unidade do PDF: o editor usa as mesmas medidas,
// escaladas pela largura da página (1pt = 100cqw / 595).

export const A4 = { widthPt: 595.28, heightPt: 841.89 };

export const FONTS = {
  inter: { label: "Inter", css: "var(--font-doc-inter), sans-serif" },
  arimo: { label: "Arimo (tipo Arial)", css: "var(--font-doc-arimo), Arial, sans-serif" },
  tinos: { label: "Tinos (tipo Times)", css: "var(--font-doc-tinos), 'Times New Roman', serif" },
  lora: { label: "Lora (serifada)", css: "var(--font-doc-lora), Georgia, serif" },
} as const;

export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

export const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32] as const;
export const LINE_HEIGHTS = [1, 1.15, 1.5, 2] as const;
export const TEXT_ALIGNS = ["left", "center", "right", "justify"] as const;

export const MARGINS = {
  narrow: { label: "Estreitas (1,5 cm)", pt: 42.52 },
  normal: { label: "Normais (2 cm)", pt: 56.69 },
  wide: { label: "Largas (2,5 cm)", pt: 70.87 },
} as const;
export type MarginKey = keyof typeof MARGINS;

export const HEADER_LAYOUTS = {
  "logo-left": "Logo à esquerda",
  centered: "Centralizado",
  "no-logo": "Sem logo",
} as const;
export type HeaderLayout = keyof typeof HEADER_LAYOUTS;

export const IMAGE_SIZES = {
  small: { label: "Pequena", logoPt: 48, signaturePt: 110 },
  medium: { label: "Média", logoPt: 72, signaturePt: 160 },
  large: { label: "Grande", logoPt: 100, signaturePt: 220 },
} as const;
export type ImageSize = keyof typeof IMAGE_SIZES;

export type TemplateSettings = {
  fontFamily: FontKey;
  fontSize: number;
  lineHeight: number;
  margins: MarginKey;
};

export const DEFAULT_SETTINGS: TemplateSettings = {
  fontFamily: "arimo",
  fontSize: 12,
  lineHeight: 1.5,
  margins: "normal",
};

/** Espaço após cada parágrafo, em pt. */
export const PARAGRAPH_SPACING_PT = 8;

// Limites de segurança do documento (também validados no servidor).
export const MAX_DOC_NODES = 3000;
export const MAX_TEXT_LENGTH = 5000;
export const MAX_LIST_DEPTH = 3;
