import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { ReceiptPreview } from "@/features/receipts/components/receipt-preview";
import { getReceiptSource } from "@/features/receipts/queries";
import { emissionFields } from "@/features/receipts/values";

export const metadata: Metadata = { title: "Prévia da correção" };

export default async function CorrectionPreviewPage({ params }: PageProps<"/recibos/[id]/corrigir/previa">) {
  const { userId } = await requireOnboardedUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [source, fields] = await Promise.all([getReceiptSource(userId, id), listFields(userId)]);
  if (!source || source.status !== "issued") notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title="Confira a correção"
        description={`${source.number} · versão ${source.versionNo + 1}`}
        back={{ href: `/recibos/${source.id}/corrigir`, label: "Formulário" }}
      />
      <ReceiptPreview
        flow={{ kind: "correct", receiptId: source.id, number: source.number, nextVersion: source.versionNo + 1 }}
        fields={emissionFields(source.usedVariables, fields)}
      />
    </div>
  );
}
