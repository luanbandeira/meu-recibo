export type AuditAction =
  | "admin.user.create"
  | "admin.user.reset_access"
  | "admin.user.disable"
  | "admin.user.enable"
  | "admin.user.delete"
  | "admin.support.start"
  | "admin.support.end"
  | "admin.support.view_pdf";

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
};

export function auditActionLabel(action: string): string {
  return labels[action as AuditAction] ?? action;
}
