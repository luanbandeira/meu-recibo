import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { AuditList } from "@/features/admin/components/audit-list";
import { UserStatusBadge } from "@/features/admin/components/user-status-badge";
import { userIdSchema } from "@/features/admin/schemas";
import { getUser, listAuditEntries } from "@/features/admin/queries";
import { requireSuperAdmin } from "@/features/auth/session";
import { formatDateTime } from "@/lib/format/date";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "Usuário" };

export default async function UserDetailPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  await requireSuperAdmin();
  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) notFound();

  const [user, history] = await Promise.all([getUser(id), listAuditEntries({ targetUserId: id, limit: 20 })]);
  if (!user) notFound();

  const details = [
    { label: "Usuário", value: `@${user.username}` },
    { label: "Criado em", value: `${formatDateTime(user.created_at)}${user.created_by_name ? ` por ${user.created_by_name}` : ""}` },
    { label: "Último acesso", value: user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Nunca acessou" },
    { label: "Configuração inicial", value: user.onboarding_completed ? "Concluída" : "Pendente" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={user.full_name ?? user.display_name} back={{ href: "/admin/usuarios", label: "Usuários" }} />

      <section aria-label="Dados da conta" className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
        <div className="mb-4">
          <UserStatusBadge user={user} />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {details.map((item) => (
            <div key={item.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</dt>
              <dd className="mt-0.5 text-sm text-slate-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="actions-title" className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
        <h2 id="actions-title" className="mb-4 text-base font-semibold text-slate-900">
          Ações
        </h2>
        <UserActions userId={user.id} displayName={user.display_name} status={user.status} />
      </section>

      <section aria-labelledby="history-title" className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
        <h2 id="history-title" className="text-base font-semibold text-slate-900">
          Histórico administrativo
        </h2>
        <div className="mt-2">
          <AuditList entries={history} showTarget={false} />
        </div>
      </section>
    </div>
  );
}
