import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import { FONTS, FONT_SIZES, LINE_HEIGHTS, type FontKey } from "@/features/templates/document/constants";

// Formatação com valores de listas fechadas: nada digitado pelo usuário vira CSS.
// Tamanhos em pt, escalados pela largura da página via var(--pt).

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    documentTextStyle: {
      setFontFamily: (font: FontKey | null) => ReturnType;
      setFontSize: (size: number | null) => ReturnType;
    };
    lineHeight: {
      setLineHeight: (value: number | null) => ReturnType;
    };
  }
}

export const TextStyle = Mark.create({
  name: "textStyle",
  priority: 101,

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (el) => {
          const value = el.getAttribute("data-font");
          return value && value in FONTS ? value : null;
        },
        renderHTML: (attrs) =>
          attrs.fontFamily && attrs.fontFamily in FONTS
            ? { "data-font": attrs.fontFamily, style: `font-family: ${FONTS[attrs.fontFamily as FontKey].css}` }
            : {},
      },
      fontSize: {
        default: null,
        parseHTML: (el) => {
          const value = Number(el.getAttribute("data-size"));
          return (FONT_SIZES as readonly number[]).includes(value) ? value : null;
        },
        renderHTML: (attrs) =>
          (FONT_SIZES as readonly number[]).includes(attrs.fontSize)
            ? { "data-size": String(attrs.fontSize), style: `font-size: calc(${attrs.fontSize} * var(--pt))` }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-font]" }, { tag: "span[data-size]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    const apply =
      (attrs: Record<string, unknown>) =>
      ({ chain, editor }: { chain: () => import("@tiptap/core").ChainedCommands; editor: import("@tiptap/core").Editor }) => {
        const current = editor.getAttributes("textStyle");
        const next = { ...current, ...attrs };
        const empty = !next.fontFamily && !next.fontSize;
        return empty ? chain().unsetMark("textStyle").run() : chain().setMark("textStyle", next).run();
      };
    return {
      setFontFamily: (font) => apply({ fontFamily: font }),
      setFontSize: (size) => apply({ fontSize: size }),
    };
  },
});

export const LineHeight = Extension.create({
  name: "lineHeight",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: () => null,
            renderHTML: (attrs) =>
              (LINE_HEIGHTS as readonly number[]).includes(attrs.lineHeight)
                ? { style: `line-height: ${attrs.lineHeight}` }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (value) =>
        ({ commands }) =>
          ["paragraph", "heading"].map((type) => commands.updateAttributes(type, { lineHeight: value })).some(Boolean),
    };
  },
});
