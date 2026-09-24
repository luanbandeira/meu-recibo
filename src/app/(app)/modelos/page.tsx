import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedUser } from "@/features/profile/guards";
import { emissionFieldKeys } from "@/features/templates/document/variables";
import { listTemplates } from "@/features/templates/queries";
import { formatDateTime } from "@/lib/format/date";
import { TemplateActions } from "./template-actions";

export const metadata: Metadata = { title: "Modelos" };

export default async function TemplatesPage({ searchParams }: PageProps<"/modelos">) {
  const { userId, support } = await requireOnboardedUser({ allowSupport: true });
  const archived = (await searchParams).arquivados === "1";
  const templates = await listTemplates(userId, archived ? "archived" : "active");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={archived ? "Modelos arquivados" : "Modelos"}
        description={archived ? "Arquivados não aparecem na emissão. Restaure ou exclua." : "Configure uma vez, emita em segundos."}
        actions={!archived && !support && <LinkButton href="/modelos/novo">+ Novo modelo</LinkButton>}
      />

      <nav aria-label="Filtros" className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/modelos"
          aria-current={!archived ? "true" : undefined}
          className={`inline-flex min-h-10 items-center rounded-full px-4 font-medium ring-1 ring-inset ${!archived ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300"}`}
        >
          Ativos
        </Link>
        <Link
          href="/modelos?arquivados=1"
          aria-current={archived ? "true" : undefined}
          className={`inline-flex min-h-10 items-center rounded-full px-4 font-medium ring-1 ring-inset ${archived ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300"}`}
        >
          Arquivados
        </Link>
        <Link href="/modelos/campos" className="ml-auto inline-flex min-h-10 items-center rounded-lg px-3 font-medium text-brand-700 hover:bg-brand-50">
          Campos personalizados →
        </Link>
      </nav>

      {templates.length === 0 ? (
        archived ? (
          <EmptyState title="Nenhum modelo arquivado" />
        ) : (
          <EmptyState
            title="Criar meu primeiro modelo"
            description="Escolha um modelo pronto (serviço, saúde, cirurgia ou em branco) e ajuste ao seu jeito."
            action={support ? undefined : <LinkButton href="/modelos/novo">Criar modelo</LinkButton>}
          />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => {
            const fields = emissionFieldKeys(template.used_variables).length;
            return (
              <li key={template.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-200">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/modelos/${template.id}/editar`} className="truncate text-base font-semibold text-slate-900 hover:text-brand-700">
                      {template.name}
                    </Link>
                    {template.is_default && (
                      <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    {fields === 1 ? "1 campo" : `${fields} campos`} na emissão · editado em {formatDateTime(template.updated_at)}
                  </p>
                </div>
                {!support && <TemplateActions id={template.id} name={template.name} archived={archived} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
