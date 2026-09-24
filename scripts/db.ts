/**
 * Comandos do banco usando SUPABASE_DB_URL (sem precisar de `supabase login`/Docker):
 *   npm run db:push        → aplica supabase/migrations no projeto de DESENVOLVIMENTO (.env.local)
 *   npm run db:push:prod   → aplica na PRODUÇÃO (.env.production.local) — só depois de testar em dev
 *   npm run db:types       → gera src/types/database.ts
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { loadLocalEnv, requireEnv } from "./env";
import { pointsToProduction } from "./production";

const production = process.argv.includes("--producao");
if (production) {
  if (!existsSync(".env.production.local")) {
    console.error("Falta o arquivo .env.production.local com as chaves da produção.");
    process.exit(1);
  }
  process.loadEnvFile(".env.production.local");
} else {
  loadLocalEnv();
}
const dbUrl = requireEnv("SUPABASE_DB_URL");
const command = process.argv[2];

if (production && !pointsToProduction(dbUrl)) {
  console.error(".env.production.local não aponta para o projeto de produção esperado.");
  process.exit(1);
}
if (!production && pointsToProduction(dbUrl)) {
  console.error(
    "O .env.local aponta para a PRODUÇÃO. Para aplicar lá de propósito, use `npm run db:push:prod`; " +
      "para desenvolver, troque o .env.local pelas chaves do projeto de desenvolvimento.",
  );
  process.exit(1);
}
if (production) console.log("⚠ Aplicando no banco de PRODUÇÃO.");

function supabase(args: string[], capture = false) {
  // Executa o CLI diretamente com o Node (sem shell): a URL contém a senha do
  // banco e não pode ser interpretada por cmd/bash.
  const cli = "node_modules/supabase/dist/supabase.js";
  const result = spawnSync(process.execPath, [cli, ...args, "--db-url", dbUrl], {
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}

if (command === "push") {
  supabase(["db", "push", "--include-all", "--yes", ...process.argv.slice(3).filter((a) => a !== "--producao")]);
} else if (command === "types") {
  const types = supabase(["gen", "types", "typescript", "--schema", "public"], true);
  writeFileSync("src/types/database.ts", types);
  console.log("Tipos gerados em src/types/database.ts");
} else {
  console.error("Uso: tsx scripts/db.ts <push|types>");
  process.exit(1);
}
