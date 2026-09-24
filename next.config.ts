import type { NextConfig } from "next";

// A CSP (com nonce por requisição) é definida no proxy: src/lib/security/csp.ts.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Fontes do PDF: lidas do disco em tempo de execução, então precisam entrar
// explicitamente no pacote das funções que geram PDF.
const pdfFonts = ["./assets/pdf-fonts/*.ttf"];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Usa WASM (yoga) e lê fontes do disco: melhor carregado pelo Node, sem bundler.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/recibos/**": pdfFonts,
    "/emitir/**": pdfFonts,
    "/recibos/**": pdfFonts,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
