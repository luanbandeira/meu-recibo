import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { z } from "zod";
import { TemplateEditor } from "@/features/editor/components/template-editor";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { signedAssetUrl } from "@/features/profile/queries";
import { DEFAULT_SETTINGS } from "@/features/templates/document/constants";
import { documentFontsClassName } from "@/features/templates/document/fonts";
import { templateSettingsSchema } from "@/features/templates/document/schema";
import { buildCatalog } from "@/features/templates/document/variables";
import { getTemplate } from "@/features/templates/queries";

export const metadata: Metadata = { title: "Editar modelo" };

export default async function EditTemplatePage({ params }: PageProps<"/modelos/[id]/editar">) {
  const { userId, professional } = await requireOnboardedUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [template, fields, logoUrl, signatureUrl] = await Promise.all([
    getTemplate(userId, id),
    listFields(userId),
    signedAssetUrl(professional.logo),
    signedAssetUrl(professional.signature),
  ]);
  if (!template) notFound();

  const settings = templateSettingsSchema.safeParse(template.settings);

  return (
    <div className={documentFontsClassName}>
      <TemplateEditor
        template={{
          id: template.id,
          name: template.name,
          content: template.content as JSONContent,
          settings: settings.success ? (settings.data as typeof DEFAULT_SETTINGS) : DEFAULT_SETTINGS,
          revision: template.revision,
        }}
        profile={professional}
        assets={{ logoUrl, signatureUrl }}
        initialCatalog={buildCatalog(fields)}
        fieldLabels={Object.fromEntries(fields.map((f) => [f.key, f.label]))}
      />
    </div>
  );
}
