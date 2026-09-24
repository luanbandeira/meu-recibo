import { Arimo, Inter, Lora, Tinos } from "next/font/google";

// Fontes do documento (licença OFL). No PDF (Fase 6) serão registradas as
// mesmas famílias, a partir dos arquivos TTF.

const inter = Inter({ subsets: ["latin"], variable: "--font-doc-inter", display: "swap" });
const arimo = Arimo({ subsets: ["latin"], variable: "--font-doc-arimo", display: "swap" });
const tinos = Tinos({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-doc-tinos", display: "swap" });
const lora = Lora({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-doc-lora", display: "swap" });

export const documentFontsClassName = [inter.variable, arimo.variable, tinos.variable, lora.variable].join(" ");
