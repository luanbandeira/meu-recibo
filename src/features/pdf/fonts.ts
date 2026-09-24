import path from "node:path";
import { Font } from "@react-pdf/renderer";
import { FONT_KEYS } from "@/features/templates/document/constants";

// Mesmas famílias do editor (licença OFL), a partir dos pacotes @fontsource
// (WOFF, subconjunto latino — cobre todo o português).
// Os arquivos entram no deploy via outputFileTracingIncludes (next.config).

const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource");

let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  for (const family of FONT_KEYS) {
    const file = (weight: 400 | 700, style: "normal" | "italic") =>
      path.join(FONT_DIR, family, "files", `${family}-latin-${weight}-${style}.woff`);
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
