import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ReceiptSummary = {
  id: string;
  number: string;
  status: "issued" | "cancelled";
  template_name: string;
  payer_name: string | null;
  amount_cents: number | null;
  service_date: string | null;
  issued_at: string;
  current_version_no: number;
};

export type ReceiptVersionInfo = {
  id: string;
  version_no: number;
  created_at: string;
  pdf_path: string | null;
  file_name: string | null;
  correction_note: string | null;
};

const SUMMARY_COLUMNS =
  "id, number, status, template_name, payer_name, amount_cents, service_date, issued_at, current_version_no";

export async function listRecentReceipts(userId: string, limit = 50): Promise<ReceiptSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipts")
    .select(SUMMARY_COLUMNS)
    .eq("user_id", userId)
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`receipts: ${error.code}`);
  return (data ?? []) as ReceiptSummary[];
}

export async function getReceipt(userId: string, id: string) {
  const supabase = await createClient();
  const { data: receipt, error } = await supabase
    .from("receipts")
    .select(SUMMARY_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle<ReceiptSummary>();
  if (error) throw new Error(`receipts: ${error.code}`);
  if (!receipt) return null;

  const { data: versions } = await supabase
    .from("receipt_versions")
    .select("id, version_no, created_at, pdf_path, file_name, correction_note")
    .eq("receipt_id", id)
    .order("version_no", { ascending: false });

  return { receipt, versions: (versions ?? []) as ReceiptVersionInfo[] };
}

/** Recibos emitidos no mês corrente (fuso de São Paulo). */
export async function countReceiptsThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3)); // 00:00 em UTC-3
  const supabase = await createClient();
  const { count } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("issued_at", monthStart.toISOString());
  return count ?? 0;
}
