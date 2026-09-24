import "server-only";
import { createHash } from "node:crypto";
import { listFields } from "@/features/fields/queries";
import { readImageInfo } from "@/features/assets/image-validation";
import { receiptFileName, renderReceiptPdf } from "@/features/pdf/render";
import type { PdfImage } from "@/features/pdf/receipt-document";
import { DEFAULT_SETTINGS, type TemplateSettings } from "@/features/templates/document/constants";
import type { DocumentProfile } from "@/features/templates/document/profile-values";
import { templateSettingsSchema } from "@/features/templates/document/schema";
import { createClient } from "@/lib/supabase/server";
import type { NormalizedValues } from "./values";

export type StoredImageRef = { bucket: string; path: string } | null;

/** Baixa uma imagem do storage privado com a sessão do usuário (RLS decide). */
export async function loadPdfImage(ref: StoredImageRef): Promise<PdfImage | null> {
  if (!ref) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(ref.bucket).download(ref.path);
  if (!data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  const info = readImageInfo(buffer);
  // O PDF aceita PNG e JPEG; os processados são sempre PNG.
  if (!info || info.mime === "image/webp") return null;
  return { data: buffer, format: info.mime === "image/png" ? "png" : "jpg", width: info.width, height: info.height };
}

export function parseSettings(value: unknown): TemplateSettings {
  const parsed = templateSettingsSchema.safeParse(value);
  return parsed.success ? (parsed.data as TemplateSettings) : DEFAULT_SETTINGS;
}

type VersionRow = {
  id: string;
  receipt_id: string;
  version_no: number;
  template_snapshot: { content: { content?: unknown[] }; settings: unknown };
  profile_snapshot: DocumentProfile & {
    logo: { bucket: string; path: string } | null;
    signature: { bucket: string; path: string } | null;
  };
  values: NormalizedValues;
  pdf_path: string | null;
  receipt: { number: string; payer_name: string | null; issued_at: string };
};

/**
 * Gera o PDF de uma versão A PARTIR DOS SNAPSHOTS (modelo e perfil do momento
 * da emissão), envia ao storage e registra caminho + SHA-256. Idempotente:
 * se a versão já tem PDF, não faz nada. Pode ser repetido após falha.
 */
export async function generateAndAttachPdf(userId: string, versionId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("receipt_versions")
    .select(
      `id, receipt_id, version_no, template_snapshot, profile_snapshot, values, pdf_path,
       receipt:receipts!receipt_versions_receipt_id_fkey(number, payer_name, issued_at)`,
    )
    .eq("id", versionId)
    .eq("user_id", userId)
    .maybeSingle<VersionRow>();
  if (!version) return { ok: false };
  if (version.pdf_path) return { ok: true };

  const [fields, logo, signature] = await Promise.all([
    listFields(userId),
    loadPdfImage(version.profile_snapshot.logo),
    loadPdfImage(version.profile_snapshot.signature),
  ]);

  const values = version.values;
  const fileName = receiptFileName({
    payer: version.receipt.payer_name,
    date: typeof values.data_emissao === "string" ? values.data_emissao : version.receipt.issued_at.slice(0, 10),
    number: version.receipt.number,
    version: version.version_no,
  });

  const pdf = await renderReceiptPdf({
    content: version.template_snapshot.content,
    settings: parseSettings(version.template_snapshot.settings),
    profile: version.profile_snapshot,
    images: { logo, signature },
    fields,
    values,
    receiptNumber: version.receipt.number,
    title: `Recibo ${version.receipt.number}`,
  });

  const path = `${userId}/${version.receipt_id}/v${version.version_no}.pdf`;
  const upload = await supabase.storage
    .from("receipts")
    .upload(path, pdf, { contentType: "application/pdf", upsert: false });
  // Já existir o arquivo = tentativa anterior subiu mas não registrou: segue para registrar.
  if (upload.error && !/exists|duplicate/i.test(upload.error.message)) return { ok: false };

  const { error } = await supabase.rpc("attach_receipt_pdf", {
    p_version_id: version.id,
    p_pdf_path: path,
    p_pdf_sha256: createHash("sha256").update(pdf).digest("hex"),
    p_file_name: fileName,
  });
  return { ok: !error };
}
