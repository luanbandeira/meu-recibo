import path from "node:path";
import { Font } from "@react-pdf/renderer";
import { FONT_KEYS } from "@/features/templates/document/constants";

// Mesmas famílias do editor (licença OFL), dos pacotes @fontsource, convertidas
// de WOFF para TTF no postinstall (scripts/build-pdf-fonts.mjs): a partir de
// WOFF, o subconjunto embutido no PDF perdia letras em negrito na tela.
// Os arquivos entram no deploy via outputFileTracingIncludes (next.config).

export const PDF_FONT_DIR = path.join(process.cwd(), "assets", "pdf-fonts");

let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  for (const family of FONT_KEYS) {
    const file = (weight: 400 | 700, style: "normal" | "italic") =>
      path.join(PDF_FONT_DIR, `${family}-latin-${weight}-${style}.ttf`);
    Font.register({
      family,
      fonts: [
        { src: file(400, "normal"), fontWeight: 400 },
        { src: file(700, "normal"), fontWeight: 700 },
        { src: file(400, "italic"), fontWeight: 400, fontStyle: "italic" },
        { src: file(700, "italic"), fontWeight: 700, fontStyle: "italic" },
      ],
    });
  }
  // O padrão do react-pdf hifeniza em inglês; em português, nada de hífen automático.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
