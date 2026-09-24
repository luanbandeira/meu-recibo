/**
 * Comandos do banco usando SUPABASE_DB_URL do .env.local (sem precisar de
 * `supabase login`/Docker):
 *   npm run db:push   → aplica supabase/migrations no projeto
 *   npm run db:types  → gera src/types/database.ts
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadLocalEnv, requireEnv } from "./env";

loadLocalEnv();
const dbUrl = requireEnv("SUPABASE_DB_URL");
const command = process.argv[2];

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
  supabase(["db", "push", "--include-all", "--yes", ...process.argv.slice(3)]);
} else if (command === "types") {
  const types = supabase(["gen", "types", "typescript", "--schema", "public"], true);
  writeFileSync("src/types/database.ts", types);
  console.log("Tipos gerados em src/types/database.ts");
} else {
  console.error("Uso: tsx scripts/db.ts <push|types>");
  process.exit(1);
}
