import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { ReceiptPreview } from "@/features/receipts/components/receipt-preview";
import { emissionFields } from "@/features/receipts/values";
import { getTemplate } from "@/features/templates/queries";

export const metadata: Metadata = { title: "Prévia do recibo" };

export default async function PreviewPage({ params }: PageProps<"/emitir/[templateId]/previa">) {
  const { userId } = await requireOnboardedUser();
  const { templateId } = await params;
  if (!z.uuid().safeParse(templateId).success) notFound();

  const [template, fields] = await Promise.all([getTemplate(userId, templateId), listFields(userId)]);
  if (!template || template.status !== "active") notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title="Confira o recibo" description={template.name} back={{ href: `/emitir/${template.id}`, label: "Formulário" }} />
      <ReceiptPreview flow={{ kind: "issue", templateId: template.id }} fields={emissionFields(template.used_variables, fields)} />
    </div>
  );
}
