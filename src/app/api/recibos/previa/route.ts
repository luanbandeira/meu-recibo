import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/features/auth/session";
import { listFields } from "@/features/fields/queries";
import { renderReceiptPdf } from "@/features/pdf/render";
import { getProfessionalProfile } from "@/features/profile/queries";
import { loadPdfImage, parseSettings } from "@/features/receipts/pdf-service";
import { emissionFields, validateValues } from "@/features/receipts/values";
import { getTemplate } from "@/features/templates/queries";

// Prévia = o PDF real, gerado em memória com os dados do formulário.
// Não salva nada e não consome número de recibo.

const bodySchema = z.object({
  templateId: z.uuid(),
  values: z.record(z.string(), z.string().max(2000)),
});

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.profile.status !== "active" || session.profile.role !== "user") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStore });

  const userId = session.userId;
  const [template, fields, professional] = await Promise.all([
    getTemplate(userId, body.data.templateId),
    listFields(userId),
    getProfessionalProfile(userId),
  ]);
  if (!template || template.status !== "active" || !professional) {
    return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404, headers: noStore });
  }

  const formFields = emissionFields(template.used_variables, fields);
  const validation = validateValues(formFields, body.data.values);
  if (!validation.ok) {
    return NextResponse.json({ error: "Dados incompletos.", errors: validation.errors }, { status: 422, headers: noStore });
  }

  const [logo, signature] = await Promise.all([
    loadPdfImage(professional.logo ? { bucket: professional.logo.bucket, path: professional.logo.storage_path } : null),
    loadPdfImage(professional.signature ? { bucket: professional.signature.bucket, path: professional.signature.storage_path } : null),
  ]);

  const pdf = await renderReceiptPdf({
    content: template.content,
    settings: parseSettings(template.settings),
    profile: professional,
    images: { logo, signature },
    fields,
    values: validation.values,
    receiptNumber: "REC-0000-000000",
    title: "Prévia do recibo",
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="previa.pdf"' },
  });
}
