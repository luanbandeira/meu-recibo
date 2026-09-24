import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { AuditList } from "@/features/admin/components/audit-list";
import { UserStatusBadge } from "@/features/admin/components/user-status-badge";
import { userIdSchema } from "@/features/admin/schemas";
import { getUser, listAuditEntries } from "@/features/admin/queries";
import { requireSuperAdmin } from "@/features/auth/session";
import { formatDateTime } from "@/lib/format/date";
import { SupportStart } from "./support-start";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "Usuário" };

export default async function UserDetailPage({ params, searchParams }: PageProps<"/admin/usuarios/[id]">) {
  await requireSuperAdmin();
  const { id } = await params;
  const { suporte } = await searchParams;
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
      {suporte === "encerrado" && <Alert tone="success">Modo de suporte encerrado. A saída foi registrada na auditoria.</Alert>}
      {suporte === "sem-configuracao" && (
        <Alert tone="info">Este usuário ainda não concluiu a configuração inicial, então não há ambiente para visualizar.</Alert>
      )}

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

      <section aria-labelledby="support-title" className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
        <h2 id="support-title" className="mb-3 text-base font-semibold text-slate-900">
          Suporte
        </h2>
        <SupportStart userId={user.id} displayName={user.display_name} available={user.onboarding_completed} />
      </section>

      <section aria-labelledby="history-title" className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="history-title" className="text-base font-semibold text-slate-900">
            Histórico administrativo
          </h2>
          <Link href={`/admin/auditoria?usuario=${user.id}`} className="text-sm font-medium text-brand-700 hover:underline">
            Ver tudo na auditoria →
          </Link>
        </div>
        <div className="mt-2">
          <AuditList entries={history} />
        </div>
      </section>
    </div>
  );
}
