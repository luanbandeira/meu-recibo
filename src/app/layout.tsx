import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "MeuRecibo", template: "%s · MeuRecibo" },
  description: "Configure uma vez, emita recibos profissionais em poucos segundos.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Toda página é renderizada por requisição: é assim que o nonce da CSP
  // (gerado no proxy) chega aos scripts. O app já é todo dinâmico (sessão).
  await connection();
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* Teclado/leitor de tela: pula cabeçalho e navegação direto para o conteúdo. */}
        <a
          href="#conteudo"
          className="sr-only z-50 rounded-lg bg-white px-4 py-3 font-medium text-brand-700 shadow-lg ring-2 ring-brand-600 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
