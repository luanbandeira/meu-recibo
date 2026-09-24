import { existsSync } from "node:fs";

/** Carrega .env.local (se existir) para scripts e testes fora do Next.js. */
export function loadLocalEnv() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Variável ausente em .env.local: ${name}`);
    process.exit(1);
  }
  return value;
}
