"use client";

// Compartilhamento nativo (Web Share API nível 2, com arquivo).
// Regra do iPhone/Safari: share() precisa ser chamado DIRETO no toque —
// sem esperar download antes. Por isso o File é preparado com antecedência.

export type ShareOutcome = "shared" | "cancelled" | "unsupported" | "failed";

export function canShareFile(file: File | null): boolean {
  if (!file || typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareFile(file: File, title: string): Promise<ShareOutcome> {
  if (!canShareFile(file)) return "unsupported";
  try {
    // Só título + arquivo: incluir "text" faz alguns apps (ex.: WhatsApp no
    // Android) enviarem apenas o texto e descartarem o PDF.
    await navigator.share({ files: [file], title });
    return "shared";
  } catch (error) {
    // AbortError = a pessoa fechou o menu de compartilhar. Não é erro.
    if ((error as DOMException).name === "AbortError") return "cancelled";
    return "failed";
  }
}

/** Fallback universal: baixa o arquivo já carregado em memória. */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
