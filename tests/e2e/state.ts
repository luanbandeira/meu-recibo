import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

// Credenciais das contas fictícias criadas para esta execução (arquivo local,
// fora do git, apagado no fim).
const FILE = "tests/e2e/.state.json";

export type E2EAccount = { id: string; username: string; password: string; fullName: string };
export type E2EState = { user: E2EAccount; admin: E2EAccount };

export const writeState = (state: E2EState) => writeFileSync(FILE, JSON.stringify(state));
export const readState = (): E2EState | null => (existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf8")) as E2EState) : null);
export const clearState = () => rmSync(FILE, { force: true });
