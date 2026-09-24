import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { UserStatusBadge } from "@/features/admin/components/user-status-badge";
import { USERS_PAGE_SIZE, listUsers } from "@/features/admin/queries";
import { requireSuperAdmin, type AccountStatus } from "@/features/auth/session";
import { formatDate, formatDateTime } from "@/lib/format/date";

export const metadata: Metadata = { title: "Usuários" };

const statusFilters: { value: string; label: string; status?: AccountStatus }[] = [
  { value: "", label: "Todos" },
  { value: "ativos", label: "Ativos", status: "active" },
  { value: "desativados", label: "Desativados", status: "disabled" },
];

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  await requireSuperAdmin();
  const params = await searchParams;
  const search = single(params.q).slice(0, 100);
  const filter = statusFilters.find((f) => f.value === single(params.situacao)) ?? statusFilters[0];
  const page = Math.max(1, Number.parseInt(single(params.pagina), 10) || 1);

  const { users, total } = await listUsers({ search, status: filter.status, page });
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const filtering = Boolean(search || filter.status);

  const hrefWith = (changes: Record<string, string | number>) => {
    const next = new URLSearchParams();
    const merged = { q: search, situacao: filter.value, pagina: String(page), ...changes };
    for (const [key, value] of Object.entries(merged)) {
      if (value && !(key === "pagina" && String(value) === "1")) next.set(key, String(value));
    }
    const query = next.toString();
    return query ? `/admin/usuarios?${query}` : "/admin/usuarios";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários"
        description={
          filtering
            ? `${total} ${total === 1 ? "usuário encontrado" : "usuários encontrados"}`
            : `${total} ${total === 1 ? "usuário" : "usuários"}`
        }
        actions={<LinkButton href="/admin/usuarios/novo">+ Criar usuário</LinkButton>}
      />
      {single(params.excluido) === "1" && (
        <Alert tone="success">Usuário excluído definitivamente, com todos os dados e arquivos. A exclusão ficou registrada na auditoria.</Alert>
      )}

      <div className="flex flex-col gap-3">
        <form role="search" action="/admin/usuarios" className="flex gap-2">
          <label htmlFor="busca" className="sr-only">
            Buscar por nome ou usuário
          </label>
          <input
            id="busca"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Buscar por nome ou usuário"
            autoComplete="off"
            className="min-h-11 w-full min-w-0 rounded-lg bg-white px-3.5 text-base ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
          {filter.value && <input type="hidden" name="situacao" value={filter.value} />}
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-lg bg-white px-4 text-sm font-medium ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            Buscar
          </button>
        </form>

        <nav aria-label="Filtrar por situação" className="flex gap-2 overflow-x-auto">
          {statusFilters.map((f) => {
            const active = f.value === filter.value;
            return (
              <Link
                key={f.value}
                href={hrefWith({ situacao: f.value, pagina: 1 })}
                aria-current={active ? "true" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap ring-1 ring-inset ${
                  active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {users.length === 0 ? (
        filtering ? (
          <EmptyState
            title="Nenhum usuário encontrado"
            description="Confira a busca ou limpe os filtros."
            action={<LinkButton href="/admin/usuarios" variant="secondary">Limpar filtros</LinkButton>}
          />
        ) : (
          <EmptyState
            title="Nenhum usuário ainda"
            description="Crie o primeiro acesso e envie o usuário e a senha temporária para a pessoa."
            action={<LinkButton href="/admin/usuarios/novo">Criar primeiro usuário</LinkButton>}
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li key={user.id}>
              <Link
                href={`/admin/usuarios/${user.id}`}
                className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-xs ring-1 ring-slate-200 transition hover:ring-brand-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{user.full_name ?? user.display_name}</p>
                  <p className="truncate text-sm text-slate-600">@{user.username}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end">
                  <UserStatusBadge user={user} />
                  <span className="text-xs text-slate-500">
                    {user.last_sign_in_at
                      ? `Último acesso ${formatDateTime(user.last_sign_in_at)}`
                      : `Criado em ${formatDate(user.created_at)}`}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-2">
          {page > 1 ? (
            <LinkButton href={hrefWith({ pagina: page - 1 })} variant="secondary">
              ← Anterior
            </LinkButton>
          ) : (
            <span />
          )}
          <span className="text-sm text-slate-600">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <LinkButton href={hrefWith({ pagina: page + 1 })} variant="secondary">
              Próxima →
            </LinkButton>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
