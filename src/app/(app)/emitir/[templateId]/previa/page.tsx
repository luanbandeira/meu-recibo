import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { signedAssetUrl } from "@/features/profile/queries";
import { ReceiptPreview } from "@/features/receipts/components/receipt-preview";
import { emissionFields } from "@/features/receipts/values";
import { DEFAULT_SETTINGS, type TemplateSettings } from "@/features/templates/document/constants";
import { documentFontsClassName } from "@/features/templates/document/fonts";
import { templateSettingsSchema } from "@/features/templates/document/schema";
import { getTemplate } from "@/features/templates/queries";

export const metadata: Metadata = { title: "Prévia do recibo" };

export default async function PreviewPage({ params }: PageProps<"/emitir/[templateId]/previa">) {
  const { userId, professional } = await requireOnboardedUser();
  const { templateId } = await params;
  if (!z.uuid().safeParse(templateId).success) notFound();

  const [template, fields, logoUrl, signatureUrl] = await Promise.all([
    getTemplate(userId, templateId),
    listFields(userId),
    signedAssetUrl(professional.logo),
    signedAssetUrl(professional.signature),
  ]);
  if (!template || template.status !== "active") notFound();

  const settings = templateSettingsSchema.safeParse(template.settings);

  return (
    <div className={`mx-auto flex w-full max-w-3xl flex-col gap-4 ${documentFontsClassName}`}>
      <PageHeader title="Confira o recibo" description={template.name} back={{ href: `/emitir/${template.id}`, label: "Formulário" }} />
      <ReceiptPreview
        templateId={template.id}
        content={template.content}
        settings={settings.success ? (settings.data as TemplateSettings) : DEFAULT_SETTINGS}
        fields={emissionFields(template.used_variables, fields)}
        labels={Object.fromEntries(fields.map((f) => [f.key, f.label]))}
        profile={professional}
        assets={{ logoUrl, signatureUrl }}
      />
    </div>
  );
}
