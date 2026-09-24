// O mesmo formulário e a mesma prévia servem para emitir um recibo novo e para
// corrigir um existente (nova versão, mesmo número). O "fluxo" decide as URLs,
// onde fica o rascunho e o que o botão final faz.

export type ReceiptFlow =
  | { kind: "issue"; templateId: string }
  | { kind: "correct"; receiptId: string; number: string; nextVersion: number };

export function flowPaths(flow: ReceiptFlow) {
  if (flow.kind === "issue") {
    const form = `/emitir/${flow.templateId}`;
    return { draftId: flow.templateId, form, preview: `${form}/previa` };
  }
  const form = `/recibos/${flow.receiptId}/corrigir`;
  return { draftId: `correcao-${flow.receiptId}`, form, preview: `${form}/previa` };
}

/** Tamanho máximo do motivo da correção (mesmo limite do banco). */
export const MAX_CORRECTION_NOTE = 500;
