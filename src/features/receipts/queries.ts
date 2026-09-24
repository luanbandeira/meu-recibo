import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, periodRange, searchTerms, type HistoryFilters } from "./history";
import type { TemplateContent } from "@/features/templates/document/schema";
import type { NormalizedValues } from "./values";

export type ReceiptSummary = {
  id: string;
  number: string;
  status: "issued" | "cancelled";
  template_id: string | null;
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
  "id, number, status, template_id, template_name, payer_name, amount_cents, service_date, issued_at, current_version_no";

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

export type ReceiptSearchResult = {
  total: number;
  totalAmountCents: number;
  items: ReceiptSummary[];
  pageCount: number;
};

/** Histórico: busca, filtros, ordenação e paginação numa única consulta (RPC com RLS). */
export async function searchReceipts(userId: string, filters: HistoryFilters, today: string): Promise<ReceiptSearchResult> {
  const { from, to } = periodRange(filters, today);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_receipts", {
    p_user_id: userId,
    p_terms: searchTerms(filters.q),
    p_from: from,
    p_to: to,
    p_template_id: filters.modelo || null,
    p_sort: filters.ordem,
    p_limit: PAGE_SIZE,
    p_offset: (filters.pagina - 1) * PAGE_SIZE,
  });
  if (error) throw new Error(`list_receipts: ${error.code}`);
  const result = data as { total: number; total_amount_cents: number; items: ReceiptSummary[] };
  return {
    total: result.total,
    totalAmountCents: Number(result.total_amount_cents),
    items: result.items,
    pageCount: Math.max(1, Math.ceil(result.total / PAGE_SIZE)),
  };
}

/** Modelos para o filtro do histórico: ativos e arquivados, por nome. */
export async function listTemplateOptions(userId: string): Promise<{ id: string; name: string; archived: boolean }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipt_templates")
    .select("id, name, status")
    .eq("user_id", userId)
    .order("name");
  if (error) throw new Error(`receipt_templates: ${error.code}`);
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, archived: t.status === "archived" }));
}

/**
 * Versão atual de um recibo, para duplicar ou corrigir: valores salvos e as
 * variáveis do modelo usado NAQUELA emissão (a correção mantém o layout).
 */
export async function getReceiptSource(userId: string, id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receipts")
    .select(
      `id, number, status, template_id, current_version_no, payer_name,
       version:receipt_versions!receipts_current_version_fk(values, template_snapshot)`,
    )
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle<{
      id: string;
      number: string;
      status: "issued" | "cancelled";
      template_id: string | null;
      current_version_no: number;
      payer_name: string | null;
      version: {
        values: NormalizedValues;
        template_snapshot: { used_variables?: string[]; name?: string; content: TemplateContent; settings: unknown };
      } | null;
    }>();
  if (!data?.version) return null;
  return {
    id: data.id,
    number: data.number,
    status: data.status,
    templateId: data.template_id,
    templateName: data.version.template_snapshot.name ?? "",
    versionNo: data.current_version_no,
    payerName: data.payer_name,
    values: data.version.values,
    usedVariables: data.version.template_snapshot.used_variables ?? [],
    templateContent: data.version.template_snapshot.content,
    templateSettings: data.version.template_snapshot.settings,
  };
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
