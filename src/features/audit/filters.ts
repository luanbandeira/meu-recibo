// Filtros da tela de auditoria (na URL) e descrição legível de cada registro.
// Funções puras.

export const AUDIT_PAGE_SIZE = 30;

export const AUDIT_ACTION_OPTIONS = [
  { value: "", label: "Todas as ações", prefix: null },
  { value: "usuarios", label: "Gestão de usuários", prefix: "admin.user" },
  { value: "suporte", label: "Modo de suporte (tudo)", prefix: "admin.support" },
  { value: "sessoes", label: "Entradas no modo de suporte", prefix: "admin.support.start" },
  { value: "pdf", label: "PDFs vistos no suporte", prefix: "admin.support.view_pdf" },
] as const;

export const AUDIT_PERIOD_OPTIONS = [
  { value: "", label: "Qualquer data", days: null },
  { value: "7d", label: "Últimos 7 dias", days: 7 },
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "90d", label: "Últimos 90 dias", days: 90 },
] as const;

export type AuditFilters = {
  acao: (typeof AUDIT_ACTION_OPTIONS)[number]["value"];
  periodo: (typeof AUDIT_PERIOD_OPTIONS)[number]["value"];
  usuario: string;
  pagina: number;
};

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function parseAuditParams(params: Params): AuditFilters {
  const acao = first(params.acao);
  const periodo = first(params.periodo);
  const usuario = first(params.usuario);
  const pagina = Number.parseInt(first(params.pagina), 10);
  return {
    acao: AUDIT_ACTION_OPTIONS.some((o) => o.value === acao) ? (acao as AuditFilters["acao"]) : "",
    periodo: AUDIT_PERIOD_OPTIONS.some((o) => o.value === periodo) ? (periodo as AuditFilters["periodo"]) : "",
    usuario: isUuid(usuario) ? usuario.toLowerCase() : "",
    pagina: Number.isFinite(pagina) && pagina > 1 ? Math.min(pagina, 10_000) : 1,
  };
}

export function auditHref(filters: Partial<AuditFilters>): string {
  const params = new URLSearchParams();
  if (filters.acao) params.set("acao", filters.acao);
  if (filters.periodo) params.set("periodo", filters.periodo);
  if (filters.usuario) params.set("usuario", filters.usuario);
  if (filters.pagina && filters.pagina > 1) params.set("pagina", String(filters.pagina));
  const query = params.toString();
  return query ? `/admin/auditoria?${query}` : "/admin/auditoria";
}

/** O que a consulta recebe: prefixo da ação e início do período. */
export function auditQuery(filters: AuditFilters, now = new Date()) {
  const prefix = AUDIT_ACTION_OPTIONS.find((o) => o.value === filters.acao)?.prefix ?? null;
  const days = AUDIT_PERIOD_OPTIONS.find((o) => o.value === filters.periodo)?.days ?? null;
  return {
    actionPrefix: prefix,
    targetUserId: filters.usuario || null,
    from: days ? new Date(now.getTime() - days * 86_400_000).toISOString() : null,
    offset: (filters.pagina - 1) * AUDIT_PAGE_SIZE,
  };
}

export type AuditDetailsInput = {
  action: string;
  metadata: Record<string, unknown> | null;
  support_reason: string | null;
};

/** Complemento do registro: motivo do suporte, documento visto, usuário criado. */
export function auditDetails(entry: AuditDetailsInput): string | null {
  const meta = entry.metadata ?? {};
  switch (entry.action) {
    case "admin.support.start":
      return entry.support_reason ? `Motivo: “${entry.support_reason}”` : null;
    case "admin.support.view_pdf": {
      const number = typeof meta.number === "string" ? meta.number : null;
      const version = typeof meta.version === "number" ? meta.version : null;
      if (!number) return null;
      return `${number}${version && version > 1 ? ` · versão ${version}` : ""}${meta.download === true ? " · baixou o arquivo" : ""}`;
    }
    case "admin.user.create":
      return typeof meta.username === "string" ? `Usuário @${meta.username}` : null;
    default:
      return null;
  }
}
