import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";
import { PDF_FONT_DIR, registerPdfFonts } from "@/features/pdf/fonts";
import { FONT_KEYS } from "@/features/templates/document/constants";

// Regressão: gerando o PDF a partir de fontes WOFF, letras em negrito sumiam
// NA TELA (o texto extraído continuava certo, então só um teste visual pega o
// sintoma). A correção é usar TTF convertido de forma exata. Estes testes
// garantem que (1) o PDF usa só TTF e (2) a conversão preserva a fonte.

type FontkitFont = { numGlyphs: number; familyName: string; glyphForCodePoint: (cp: number) => { id: number; path: { commands: unknown[] } } };
const open = (file: string) => (fontkit as unknown as { openSync: (f: string) => FontkitFont }).openSync(file);

const VARIANTS = ["400-normal", "700-normal", "400-italic", "700-italic"];
const SAMPLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõçºª–“”";

describe("fontes do PDF", () => {
  it("o PDF registra apenas arquivos TTF existentes (nunca WOFF)", () => {
    registerPdfFonts();
    const registered = Font.getRegisteredFonts() as unknown as Record<string, { sources: { src: string }[] }>;
    for (const family of FONT_KEYS) {
      const sources = registered[family]?.sources ?? [];
      expect(sources).toHaveLength(4);
      for (const { src } of sources) {
        expect(src.endsWith(".ttf")).toBe(true);
        expect(existsSync(src)).toBe(true);
      }
    }
  });

  it.each(FONT_KEYS.flatMap((family) => VARIANTS.map((variant) => `${family}-latin-${variant}`)))(
    "%s: TTF convertido é idêntico ao original (glifos e contornos)",
    (name) => {
      const ttfPath = path.join(PDF_FONT_DIR, `${name}.ttf`);
      const ttf = open(ttfPath);
      const woff = open(`node_modules/@fontsource/${name.split("-")[0]}/files/${name}.woff`);
      expect(readFileSync(ttfPath).readUInt32BE(0)).toBe(0x00010000); // assinatura TrueType
      expect(ttf.numGlyphs).toBe(woff.numGlyphs);
      for (const char of SAMPLE) {
        const a = ttf.glyphForCodePoint(char.codePointAt(0)!);
        const b = woff.glyphForCodePoint(char.codePointAt(0)!);
        expect(a.id, char).toBe(b.id);
        expect(a.path.commands.length, char).toBe(b.path.commands.length);
        expect(a.path.commands.length, `${char} sem desenho`).toBeGreaterThan(0);
      }
    },
  );
});
