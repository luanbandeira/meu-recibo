import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { EmissionForm } from "@/features/receipts/components/emission-form";
import { getReceiptSource } from "@/features/receipts/queries";
import { emissionFields, initialRawValues, offersSignatureChoice, todayIso } from "@/features/receipts/values";
import { SIGNATURE_MODE_KEY, signatureModeOf } from "@/features/templates/document/signatures";
import { getTemplate } from "@/features/templates/queries";

export const metadata: Metadata = { title: "Emitir recibo" };

export default async function EmitFormPage({ params, searchParams }: PageProps<"/emitir/[templateId]">) {
  const { userId, professional } = await requireOnboardedUser();
  const { templateId } = await params;
  const { duplicar } = await searchParams;
  const duplicateId = typeof duplicar === "string" && z.uuid().safeParse(duplicar).success ? duplicar : null;
  if (!z.uuid().safeParse(templateId).success) notFound();

  const [template, fields, source] = await Promise.all([
    getTemplate(userId, templateId),
    listFields(userId),
    duplicateId ? getReceiptSource(userId, duplicateId) : null,
  ]);
  if (!template || template.status !== "active") {
    // Duplicar um recibo cujo modelo foi arquivado: escolhe outro modelo.
    if (source) redirect(`/emitir?duplicar=${source.id}`);
    notFound();
  }

  const formFields = emissionFields(template.used_variables, fields);
  const context = { today: todayIso(professional.timezone), city: professional.city };
  const defaults = initialRawValues(formFields, context);

  // Duplicar: novo recibo com os dados do original, exceto a data de emissão (hoje).
  let seed: { values: Record<string, string>; notice: string } | undefined;
  if (source) {
    const copied = { ...source.values };
    delete copied.data_emissao;
    seed = {
      values: { ...initialRawValues(formFields, context, copied), [SIGNATURE_MODE_KEY]: signatureModeOf(source.values) },
      notice: `Dados copiados do recibo ${source.number}. Confira as datas e o valor antes de emitir.`,
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        title={template.name}
        description={source ? "Novo recibo a partir de uma cópia." : "Preencha os dados deste recibo."}
        back={source ? { href: `/recibos/${source.id}`, label: "Recibo original" } : { href: "/emitir", label: "Modelos" }}
      />
      <EmissionForm
        flow={{ kind: "issue", templateId: template.id }}
        fields={formFields}
        defaults={defaults}
        seed={seed}
        signatureChoice={offersSignatureChoice(template.used_variables) && Boolean(professional.signature)}
      />
    </div>
  );
}
