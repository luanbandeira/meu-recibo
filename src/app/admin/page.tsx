import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { AuditList } from "@/features/admin/components/audit-list";
import { getUserStats, listAuditEntries } from "@/features/admin/queries";
import { requireSuperAdmin } from "@/features/auth/session";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminHomePage({ searchParams }: PageProps<"/admin">) {
  await requireSuperAdmin();
  const supportEnded = (await searchParams).suporte === "encerrado";
  const [stats, recent] = await Promise.all([getUserStats(), listAuditEntries({ limit: 8 })]);

  const cards = [
    { label: "Usuários ativos", value: stats.active, href: "/admin/usuarios?situacao=ativos" },
    { label: "Desativados", value: stats.disabled, href: "/admin/usuarios?situacao=desativados" },
    { label: "Total de usuários", value: stats.total, href: "/admin/usuarios" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Visão geral"
        actions={<LinkButton href="/admin/usuarios/novo">+ Criar usuário</LinkButton>}
      />
      {supportEnded && <Alert tone="info">O modo de suporte foi encerrado ou expirou (30 minutos). Para continuar, abra-o de novo na ficha do usuário.</Alert>}

      <section aria-label="Resumo de usuários" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 transition hover:ring-brand-300"
          >
            <p className="text-sm text-slate-600">{card.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{card.value}</p>
          </Link>
        ))}
      </section>

      {stats.pending_first_access > 0 && (
        <p className="text-sm text-slate-600">
          {stats.pending_first_access === 1
            ? "1 usuário ainda não trocou a senha temporária."
            : `${stats.pending_first_access} usuários ainda não trocaram a senha temporária.`}
        </p>
      )}

      <section aria-labelledby="recent-title" className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-title" className="text-base font-semibold text-slate-900">
            Últimas ações administrativas
          </h2>
          <Link href="/admin/auditoria" className="text-sm font-medium text-brand-700 hover:underline">
            Ver auditoria completa →
          </Link>
        </div>
        <div className="mt-2">
          <AuditList entries={recent} />
        </div>
      </section>
    </div>
  );
}
