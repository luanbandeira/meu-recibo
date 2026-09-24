"use client";

import type { RawValues } from "./values";

// Rascunho do formulário de emissão no sessionStorage DESTE aparelho/aba:
// sobrevive à ida e volta da prévia, some ao fechar a aba, ao emitir e ao sair.
// Contém dados pessoais (paciente, CPF): nunca vai para localStorage nem servidor.

const PREFIX = "meurecibo:rascunho:";
// draftId: id do modelo (emissão) ou "correcao-<id do recibo>" (correção).
const key = (draftId: string) => `${PREFIX}${draftId}`;

export function readDraftRaw(draftId: string): string | null {
  try {
    return sessionStorage.getItem(key(draftId));
  } catch {
    return null;
  }
}

export function parseDraft(raw: string | null): RawValues | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { values?: unknown };
    return parsed.values && typeof parsed.values === "object" ? (parsed.values as RawValues) : null;
  } catch {
    return null;
  }
}

export function writeDraft(draftId: string, values: RawValues) {
  try {
    sessionStorage.setItem(key(draftId), JSON.stringify({ values, at: Date.now() }));
    // Dados mudaram: a próxima emissão é outro recibo (nova chave de idempotência).
    sessionStorage.removeItem(`meurecibo:emissao:${draftId}`);
  } catch {
    // Sem armazenamento: o formulário continua funcionando, só não sobrevive à navegação.
  }
}

export function clearDraft(draftId: string) {
  try {
    sessionStorage.removeItem(key(draftId));
  } catch {}
}

/** Apaga todos os rascunhos (ao sair da conta). */
export function clearAllDrafts() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX) || k.startsWith("meurecibo:emissao:"))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

// Chave de idempotência da emissão: a MESMA enquanto o rascunho existir, então
// um duplo toque ou uma nova tentativa após queda de conexão nunca gera dois
// recibos. Renovada após emitir com sucesso.
const idemKey = (draftId: string) => `meurecibo:emissao:${draftId}`;

export function idempotencyKeyFor(draftId: string): string {
  try {
    const existing = sessionStorage.getItem(idemKey(draftId));
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(idemKey(draftId), created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function resetIdempotencyKey(draftId: string) {
  try {
    sessionStorage.removeItem(idemKey(draftId));
  } catch {}
}
