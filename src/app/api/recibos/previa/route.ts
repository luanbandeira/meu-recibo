import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/features/auth/session";
import { listFields } from "@/features/fields/queries";
import { renderReceiptPdf } from "@/features/pdf/render";
import { getProfessionalProfile } from "@/features/profile/queries";
import { loadPdfImage, parseSettings } from "@/features/receipts/pdf-service";
import { getReceiptSource } from "@/features/receipts/queries";
import { emissionFields, validateValues } from "@/features/receipts/values";
import { getTemplate } from "@/features/templates/queries";
import { RATE_LIMIT_MESSAGE, withinRateLimit } from "@/lib/security/rate-limit";

// Prévia = o PDF real, gerado em memória com os dados do formulário.
// Não salva nada e não consome número de recibo.
// Emissão: layout do modelo atual. Correção: layout salvo na versão atual do
// recibo (o mesmo que a RPC correct_receipt usa) e o número verdadeiro.

const valuesSchema = z.record(z.string(), z.string().max(2000));
const bodySchema = z.union([
  z.object({ templateId: z.uuid(), values: valuesSchema }),
  z.object({ receiptId: z.uuid(), values: valuesSchema }),
]);

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.profile.status !== "active" || session.profile.role !== "user") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  }

  if (!(await withinRateLimit("pdfPreview", session.userId))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429, headers: { ...noStore, "Retry-After": "60" } });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: noStore });

  const userId = session.userId;
  const [layout, fields, professional] = await Promise.all([
    "templateId" in body.data ? templateLayout(userId, body.data.templateId) : receiptLayout(userId, body.data.receiptId),
    listFields(userId),
    getProfessionalProfile(userId),
  ]);
  if (!layout || !professional) {
    return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404, headers: noStore });
  }

  const formFields = emissionFields(layout.usedVariables, fields);
  const validation = validateValues(formFields, body.data.values);
  if (!validation.ok) {
    return NextResponse.json({ error: "Dados incompletos.", errors: validation.errors }, { status: 422, headers: noStore });
  }

  const [logo, signature] = await Promise.all([
    loadPdfImage(professional.logo ? { bucket: professional.logo.bucket, path: professional.logo.storage_path } : null),
    loadPdfImage(professional.signature ? { bucket: professional.signature.bucket, path: professional.signature.storage_path } : null),
  ]);

  const pdf = await renderReceiptPdf({
    content: layout.content,
    settings: parseSettings(layout.settings),
    profile: professional,
    images: { logo, signature },
    fields,
    values: validation.values,
    receiptNumber: layout.receiptNumber,
    title: "Prévia do recibo",
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="previa.pdf"' },
  });
}

async function templateLayout(userId: string, templateId: string) {
  const template = await getTemplate(userId, templateId);
  if (!template || template.status !== "active") return null;
  return {
    content: template.content,
    settings: template.settings,
    usedVariables: template.used_variables,
    receiptNumber: "REC-0000-000000",
  };
}

async function receiptLayout(userId: string, receiptId: string) {
  const source = await getReceiptSource(userId, receiptId);
  if (!source || source.status !== "issued") return null;
  return {
    content: source.templateContent,
    settings: source.templateSettings,
    usedVariables: source.usedVariables,
    receiptNumber: source.number,
  };
}
