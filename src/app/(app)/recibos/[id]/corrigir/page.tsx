import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { EmissionForm } from "@/features/receipts/components/emission-form";
import { getReceiptSource } from "@/features/receipts/queries";
import { emissionFields, initialRawValues, todayIso } from "@/features/receipts/values";

export const metadata: Metadata = { title: "Corrigir recibo" };

export default async function CorrectReceiptPage({ params }: PageProps<"/recibos/[id]/corrigir">) {
  const { userId, professional } = await requireOnboardedUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [source, fields] = await Promise.all([getReceiptSource(userId, id), listFields(userId)]);
  if (!source || source.status !== "issued") notFound();

  // Campos do modelo usado na versão atual, preenchidos com os dados dela.
  const formFields = emissionFields(source.usedVariables, fields);
  const defaults = initialRawValues(
    formFields,
    { today: todayIso(professional.timezone), city: professional.city },
    source.values,
  );
  const nextVersion = source.versionNo + 1;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        title="Corrigir recibo"
        description={`${source.number}${source.payerName ? ` · ${source.payerName}` : ""}`}
        back={{ href: `/recibos/${source.id}`, label: "Recibo" }}
      />
      <Alert tone="info">
        A correção cria a versão {nextVersion} com o mesmo número ({source.number}). A versão {source.versionNo} e o PDF dela
        continuam guardados.
      </Alert>
      <EmissionForm
        flow={{ kind: "correct", receiptId: source.id, number: source.number, nextVersion }}
        fields={formFields}
        defaults={defaults}
      />
    </div>
  );
}
