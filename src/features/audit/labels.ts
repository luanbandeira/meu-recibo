export type AuditAction =
  | "admin.user.create"
  | "admin.user.reset_access"
  | "admin.user.disable"
  | "admin.user.enable"
  | "admin.user.delete"
  | "admin.support.start"
  | "admin.support.end"
  | "admin.support.view_pdf"
  | "user.receipt.delete";

// Frases no formato "<quem> <ação> <usuário afetado>".
const labels: Record<AuditAction, string> = {
  "admin.user.create": "criou o usuário",
  "admin.user.reset_access": "redefiniu o acesso de",
  "admin.user.disable": "desativou",
  "admin.user.enable": "reativou",
  "admin.user.delete": "excluiu definitivamente um usuário",
  "admin.support.start": "entrou no modo de suporte de",
  "admin.support.end": "saiu do modo de suporte de",
  "admin.support.view_pdf": "abriu um PDF de",
  "user.receipt.delete": "excluiu um recibo",
};

/** Ação do próprio usuário (não de admin): quem fez É o afetado. */
export function isUserAction(action: string): boolean {
  return action.startsWith("user.");
}

/** Nome de quem fez, quando a conta já foi excluída. */
export function removedActorLabel(action: string): string {
  return isUserAction(action) ? "Usuário excluído" : "Administrador removido";
}

export function auditActionLabel(action: string): string {
  return labels[action as AuditAction] ?? action;
}
