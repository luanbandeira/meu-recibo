"use client";

import type { RawValues } from "./values";

// Rascunho do formulário de emissão no sessionStorage DESTE aparelho/aba:
// sobrevive à ida e volta da prévia, some ao fechar a aba, ao emitir e ao sair.
// Contém dados pessoais (paciente, CPF): nunca vai para localStorage nem servidor.

const PREFIX = "meurecibo:rascunho:";
const key = (templateId: string) => `${PREFIX}${templateId}`;

export function readDraftRaw(templateId: string): string | null {
  try {
    return sessionStorage.getItem(key(templateId));
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

export function writeDraft(templateId: string, values: RawValues) {
  try {
    sessionStorage.setItem(key(templateId), JSON.stringify({ values, at: Date.now() }));
  } catch {
    // Sem armazenamento: o formulário continua funcionando, só não sobrevive à navegação.
  }
}

export function clearDraft(templateId: string) {
  try {
    sessionStorage.removeItem(key(templateId));
  } catch {}
}

/** Apaga todos os rascunhos (ao sair da conta). */
export function clearAllDrafts() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}
