import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { EmissionForm } from "@/features/receipts/components/emission-form";
import { emissionFields, initialRawValues, todayIso } from "@/features/receipts/values";
import { getTemplate } from "@/features/templates/queries";

export const metadata: Metadata = { title: "Emitir recibo" };

export default async function EmitFormPage({ params }: PageProps<"/emitir/[templateId]">) {
  const { userId, professional } = await requireOnboardedUser();
  const { templateId } = await params;
  if (!z.uuid().safeParse(templateId).success) notFound();

  const [template, fields] = await Promise.all([getTemplate(userId, templateId), listFields(userId)]);
  if (!template || template.status !== "active") notFound();

  const formFields = emissionFields(template.used_variables, fields);
  const defaults = initialRawValues(formFields, {
    today: todayIso(professional.timezone),
    city: professional.city,
  });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader title={template.name} description="Preencha os dados deste recibo." back={{ href: "/emitir", label: "Modelos" }} />
      <EmissionForm templateId={template.id} fields={formFields} defaults={defaults} />
    </div>
  );
}
