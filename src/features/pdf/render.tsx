import { renderToBuffer } from "@react-pdf/renderer";
import { createResolver, type NormalizedValues } from "@/features/receipts/values";
import type { TemplateSettings } from "@/features/templates/document/constants";
import type { DocumentProfile } from "@/features/templates/document/profile-values";
import type { FieldDefinition } from "@/features/templates/document/variables";
import { registerPdfFonts } from "./fonts";
import { ReceiptDocument, type PdfImage } from "./receipt-document";

export type RenderReceiptInput = {
  content: { content?: unknown[] };
  settings: TemplateSettings;
  profile: DocumentProfile;
  images: { logo: PdfImage | null; signature: PdfImage | null };
  fields: FieldDefinition[];
  values: NormalizedValues;
  receiptNumber: string | null;
  title: string;
};

/** Gera o PDF do recibo (A4, texto vetorial, fontes embutidas). */
export async function renderReceiptPdf(input: RenderReceiptInput): Promise<Buffer> {
  registerPdfFonts();
  const resolver = createResolver({
    fields: input.fields,
    values: input.values,
    profile: input.profile,
    receiptNumber: input.receiptNumber,
  });
  return renderToBuffer(
    <ReceiptDocument
      content={input.content}
      settings={input.settings}
      profile={input.profile}
      images={input.images}
      resolve={(key, format) => resolver(key, format).text}
      title={input.title}
    />,
  );
}

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Nome amigável e seguro: recibo-maria-silva-23-09-2026.pdf
 * Só [a-z0-9-], até 80 caracteres (validado também no banco).
 */
export function receiptFileName(params: { payer: string | null; date: string | null; number: string }) {
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date.split("-").reverse().join("-") : null;
  const payer = params.payer ? slug(params.payer).slice(0, 40).replace(/-+$/, "") : "";
  const base = ["recibo", payer || slug(params.number), date].filter(Boolean).join("-");
  return `${base.slice(0, 76).replace(/-+$/, "")}.pdf`;
}
