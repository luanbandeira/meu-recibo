import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { getReceiptSource } from "@/features/receipts/queries";
import { emissionFields } from "@/features/receipts/values";
import { listTemplates } from "@/features/templates/queries";

export const metadata: Metadata = { title: "Emitir recibo" };

export default async function EmitPage({ searchParams }: PageProps<"/emitir">) {
  const { userId } = await requireOnboardedUser();
  const { duplicar } = await searchParams;
  const duplicateId = typeof duplicar === "string" && z.uuid().safeParse(duplicar).success ? duplicar : null;
  const [templates, fields, source] = await Promise.all([
    listTemplates(userId),
    listFields(userId),
    duplicateId ? getReceiptSource(userId, duplicateId) : null,
  ]);
  const suffix = source ? `?duplicar=${source.id}` : "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Emitir recibo" description="Escolha o modelo. Você preenche só o que muda neste recibo." />
      {source && (
        <Alert tone="info">
          O modelo do recibo {source.number} não está mais disponível. Escolha um modelo para o novo recibo — os dados serão
          copiados.
        </Alert>
      )}

      {templates.length === 0 ? (
        <EmptyState
          title="Você ainda não tem modelos"
          description="Crie um modelo uma vez e emita recibos em segundos."
          action={<LinkButton href="/modelos/novo">Criar meu primeiro modelo</LinkButton>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {templates.map((template) => {
            const fieldLabels = emissionFields(template.used_variables, fields).map((f) => f.label);
            return (
              <li key={template.id}>
                <Link
                  href={`/emitir/${template.id}${suffix}`}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 transition hover:ring-brand-400 active:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{template.name}</p>
                    <p className="line-clamp-2 text-sm text-slate-600">
                      {fieldLabels.length ? fieldLabels.join(", ") : "Nenhum campo a preencher"}
                    </p>
                  </div>
                  <span aria-hidden="true" className="text-2xl text-brand-600">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
