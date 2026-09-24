import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/security/cron";
import { createAdminClient } from "@/lib/supabase/admin";

// Mantém o projeto Supabase (plano gratuito) ativo: sem nenhuma atividade por
// 7 dias ele é pausado. Um Cron Job da Vercel (vercel.json) chama esta rota
// uma vez por dia; a consulta só conta linhas — não lê nenhum dado.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    // Diz só SE a chave está configurada (ajuda a diagnosticar), nunca qual é.
    const reason = process.env.CRON_SECRET ? "chave ausente ou incorreta" : "CRON_SECRET não configurado neste deploy";
    return NextResponse.json({ error: "Não autorizado.", reason }, { status: 401 });
  }

  const { error } = await createAdminClient().from("profiles").select("id", { count: "exact", head: true });
  if (error) {
    console.error("[keep-alive] banco não respondeu", { code: error.code });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
