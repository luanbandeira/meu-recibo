export type AuditAction =
  | "admin.user.create"
  | "admin.user.reset_access"
  | "admin.user.disable"
  | "admin.user.enable"
  | "admin.support.start"
  | "admin.support.end"
  | "admin.support.view_pdf";

const labels: Record<AuditAction, string> = {
  "admin.user.create": "Criou o usuário",
  "admin.user.reset_access": "Redefiniu o acesso",
  "admin.user.disable": "Desativou o usuário",
  "admin.user.enable": "Reativou o usuário",
  "admin.support.start": "Entrou em modo de suporte",
  "admin.support.end": "Saiu do modo de suporte",
  "admin.support.view_pdf": "Visualizou PDF em modo de suporte",
};

export function auditActionLabel(action: string): string {
  return labels[action as AuditAction] ?? action;
}
