// Executa um script TypeScript com o mesmo carregador do Vitest (Vite SSR).
// Necessário para scripts que geram PDF: o @react-pdf só exporta módulos ES,
// e o tsx os carrega como CommonJS.
//
// Uso: node scripts/run-ts.mjs scripts/seed.ts
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const entry = process.argv[2];
if (!entry) {
  console.error("Uso: node scripts/run-ts.mjs <arquivo.ts>");
  process.exit(1);
}

const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});

let code = 0;
try {
  const mod = await server.ssrLoadModule(`/${entry.replace(/\\/g, "/")}`);
  // O script exporta por padrão a função principal; espera ela terminar antes de fechar.
  if (typeof mod.default === "function") await mod.default();
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  await server.close();
}
process.exit(process.exitCode ?? code);
