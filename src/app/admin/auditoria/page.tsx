import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { getUser, searchAudit } from "@/features/admin/queries";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_PAGE_SIZE,
  AUDIT_PERIOD_OPTIONS,
  auditDetails,
  auditHref,
  auditQuery,
  parseAuditParams,
} from "@/features/audit/filters";
import { auditActionLabel, isUserAction, removedActorLabel } from "@/features/audit/labels";
import { requireSuperAdmin } from "@/features/auth/session";
import { formatDateTime } from "@/lib/format/date";

export const metadata: Metadata = { title: "Auditoria" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  await requireSuperAdmin();
  const filters = parseAuditParams(await searchParams);
  const query = auditQuery(filters);
  const [{ rows, total }, user] = await Promise.all([
    searchAudit({ ...query, limit: AUDIT_PAGE_SIZE }),
    filters.usuario ? getUser(filters.usuario) : null,
  ]);
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const filtered = Boolean(filters.acao || filters.periodo || filters.usuario);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoria"
        description="Tudo o que os administradores fizeram: gestão de usuários, acessos em modo de suporte e PDFs vistos. Os registros não podem ser alterados nem apagados."
      />

      {/* Formulário GET: funciona sem JavaScript e mantém os filtros na URL. */}
      <form method="get" action="/admin/auditoria" className="grid gap-3 rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-200 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <SelectField
          label="Ação"
          name="acao"
          defaultValue={filters.acao}
          options={AUDIT_ACTION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <SelectField
          label="Período"
          name="periodo"
          defaultValue={filters.periodo}
          options={AUDIT_PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        {filters.usuario && <input type="hidden" name="usuario" value={filters.usuario} />}
        <button type="submit" className="min-h-12 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
          Filtrar
        </button>
        {(user || filtered) && (
          <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-3">
            {user && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-slate-800 ring-1 ring-inset ring-slate-200">
                Usuário: {user.full_name ?? user.display_name}
                <Link
                  href={auditHref({ ...filters, usuario: "", pagina: 1 })}
                  aria-label="Remover filtro de usuário"
                  className="inline-flex size-7 items-center justify-center rounded-full hover:bg-slate-200"
                >
                  ✕
                </Link>
              </span>
            )}
            {filtered && (
              <Link href="/admin/auditoria" className="inline-flex min-h-10 items-center rounded-lg px-2 font-medium text-brand-700 hover:bg-brand-50">
                Limpar filtros
              </Link>
            )}
          </div>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={filters.pagina > 1 ? "Esta página está vazia." : "Nenhum registro encontrado."}
          description={filtered ? "Mude os filtros para ver outros registros." : undefined}
        />
      ) : (
        <section aria-label="Registros" className="rounded-2xl bg-white shadow-xs ring-1 ring-slate-200">
          <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-600">
            {total} {total === 1 ? "registro" : "registros"}
          </p>
          <ol className="divide-y divide-slate-100">
            {rows.map((row) => {
              const details = auditDetails(row);
              return (
                <li key={row.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900">
                      {isUserAction(row.action) && row.target_user_id ? (
                        <Link href={`/admin/usuarios/${row.target_user_id}`} className="font-medium text-brand-700 hover:underline">
                          {row.target_name ?? row.actor_name}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.actor_name ?? removedActorLabel(row.action)}</span>
                      )}{" "}
                      {auditActionLabel(row.action)}
                      {isUserAction(row.action) ? null : row.target_user_id ? (
                        <>
                          {" "}
                          <Link href={`/admin/usuarios/${row.target_user_id}`} className="font-medium text-brand-700 hover:underline">
                            {row.target_name ?? row.target_username}
                          </Link>
                        </>
                      ) : row.action === "admin.user.delete" ? null : (
                        <span className="text-slate-500"> (usuário excluído)</span>
                      )}
                    </p>
                    {details && <p className="mt-0.5 break-words text-sm text-slate-600">{details}</p>}
                  </div>
                  <time dateTime={row.created_at} className="shrink-0 text-xs text-slate-500 tabular-nums">
                    {formatDateTime(row.created_at)}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {pageCount > 1 && rows.length > 0 && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-2 text-sm">
          {filters.pagina > 1 ? (
            <Link href={auditHref({ ...filters, pagina: filters.pagina - 1 })} className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-brand-700 hover:bg-brand-50">
              ← Mais recentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-600">
            Página {filters.pagina} de {pageCount}
          </span>
          {filters.pagina < pageCount ? (
            <Link href={auditHref({ ...filters, pagina: filters.pagina + 1 })} className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-brand-700 hover:bg-brand-50">
              Mais antigos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
