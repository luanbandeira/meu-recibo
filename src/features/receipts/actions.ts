"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { getTemplate } from "@/features/templates/queries";
import { createClient } from "@/lib/supabase/server";
import { MAX_CORRECTION_NOTE } from "./flow";
import { generateAndAttachPdf } from "./pdf-service";
import { getReceiptSource } from "./queries";
import { buildSummary, emissionFields, validateValues, type RawValues } from "./values";

const uuid = z.uuid();

export type IssueResult =
  | { ok: true; receiptId: string; pdfReady: boolean }
  | { ok: false; errors?: Record<string, string>; error?: string };

/**
 * Emite o recibo: valida no servidor (mesma regra do navegador), aloca número
 * e cria a versão 1 com snapshots numa transação (RPC), depois gera o PDF.
 * A chave de idempotência impede recibo duplicado por duplo toque.
 */
export async function issueReceipt(input: {
  templateId: string;
  values: RawValues;
  idempotencyKey: string;
}): Promise<IssueResult> {
  const { userId } = await requireOnboardedUser();
  if (!uuid.safeParse(input.templateId).success || !uuid.safeParse(input.idempotencyKey).success) {
    return { ok: false, error: "Dados inválidos." };
  }
  if (!input.values || typeof input.values !== "object") return { ok: false, error: "Dados inválidos." };

  const [template, fields] = await Promise.all([getTemplate(userId, input.templateId), listFields(userId)]);
  if (!template || template.status !== "active") return { ok: false, error: "Modelo não encontrado." };

  const formFields = emissionFields(template.used_variables, fields);
  const rawValues = Object.fromEntries(formFields.map((f) => [f.key, String(input.values[f.key] ?? "")]));
  const validation = validateValues(formFields, rawValues);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_receipt", {
    p_template_id: template.id,
    p_values: validation.values,
    p_summary: buildSummary(formFields, validation.values),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error || !data) return { ok: false, error: "Não foi possível emitir o recibo. Tente novamente." };

  const issued = data as { receipt_id: string; version_id: string };
  const pdf = await generateAndAttachPdf(userId, issued.version_id).catch(() => ({ ok: false }));

  revalidatePath("/recibos");
  revalidatePath("/dashboard");
  return { ok: true, receiptId: issued.receipt_id, pdfReady: pdf.ok };
}

/**
 * "Corrigir recibo": nova versão com o MESMO número. Os campos são os do
 * modelo usado na versão atual (a RPC mantém esse layout); a versão anterior
 * e o PDF dela continuam intactos. Idempotente como a emissão.
 */
export async function correctReceipt(input: {
  receiptId: string;
  values: RawValues;
  note: string;
  idempotencyKey: string;
}): Promise<IssueResult> {
  const { userId } = await requireOnboardedUser();
  if (!uuid.safeParse(input.receiptId).success || !uuid.safeParse(input.idempotencyKey).success) {
    return { ok: false, error: "Dados inválidos." };
  }
  if (!input.values || typeof input.values !== "object") return { ok: false, error: "Dados inválidos." };
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > MAX_CORRECTION_NOTE) return { ok: false, error: `Use no máximo ${MAX_CORRECTION_NOTE} caracteres no motivo.` };

  const [source, fields] = await Promise.all([getReceiptSource(userId, input.receiptId), listFields(userId)]);
  if (!source) return { ok: false, error: "Recibo não encontrado." };
  if (source.status !== "issued") return { ok: false, error: "Este recibo não pode ser corrigido." };

  const formFields = emissionFields(source.usedVariables, fields);
  const rawValues = Object.fromEntries(formFields.map((f) => [f.key, String(input.values[f.key] ?? "")]));
  const validation = validateValues(formFields, rawValues);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("correct_receipt", {
    p_receipt_id: source.id,
    p_values: validation.values,
    p_summary: buildSummary(formFields, validation.values),
    p_note: note || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error || !data) return { ok: false, error: "Não foi possível salvar a correção. Tente novamente." };

  const corrected = data as { receipt_id: string; version_id: string };
  const pdf = await generateAndAttachPdf(userId, corrected.version_id).catch(() => ({ ok: false }));

  revalidatePath("/recibos");
  revalidatePath(`/recibos/${source.id}`);
  revalidatePath("/dashboard");
  return { ok: true, receiptId: corrected.receipt_id, pdfReady: pdf.ok };
}

/** Gera novamente o PDF de uma versão que ficou sem arquivo (falha anterior). */
export async function retryReceiptPdf(receiptId: string): Promise<{ ok: boolean }> {
  const { userId } = await requireOnboardedUser();
  if (!uuid.safeParse(receiptId).success) return { ok: false };
  const supabase = await createClient();
  const { data } = await supabase.from("receipts").select("current_version_id").eq("id", receiptId).eq("user_id", userId).maybeSingle();
  if (!data?.current_version_id) return { ok: false };
  const result = await generateAndAttachPdf(userId, data.current_version_id).catch(() => ({ ok: false }));
  revalidatePath(`/recibos/${receiptId}`);
  return result;
}
