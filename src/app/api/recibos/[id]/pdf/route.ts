import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/features/audit/log";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMIT_MESSAGE, withinRateLimit } from "@/lib/security/rate-limit";

// Entrega o PDF salvo. Tudo pela sessão do usuário: a RLS decide se ele
// pode ver o recibo e o arquivo. Nunca expõe URL pública do storage.
// Super admin só chega aqui com sessão de suporte aberta (senão a RLS não
// devolve nada) e cada PDF entregue a ele fica na auditoria.

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, { params }: RouteContext<"/api/recibos/[id]/pdf">) {
  const session = await getSession();
  if (!session || session.profile.status !== "active") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  }

  if (!(await withinRateLimit("pdfDownload", session.userId))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429, headers: { ...noStore, "Retry-After": "60" } });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: noStore });

  const versionParam = request.nextUrl.searchParams.get("versao");
  const versionNo = versionParam ? Number.parseInt(versionParam, 10) : null;

  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, user_id, number, current_version_no")
    .eq("id", id)
    .maybeSingle();
  if (!receipt) return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: noStore });

  const { data: version } = await supabase
    .from("receipt_versions")
    .select("version_no, pdf_path, file_name")
    .eq("receipt_id", id)
    .eq("version_no", versionNo && versionNo > 0 ? versionNo : receipt.current_version_no)
    .maybeSingle();
  if (!version?.pdf_path) return NextResponse.json({ error: "PDF ainda não gerado." }, { status: 404, headers: noStore });

  const { data: file } = await supabase.storage.from("receipts").download(version.pdf_path);
  if (!file) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404, headers: noStore });

  const fileName = version.file_name ?? "recibo.pdf";
  const download = request.nextUrl.searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";

  if (session.profile.role === "super_admin") {
    // Número e versão identificam o documento sem expor dados pessoais.
    await writeAuditLog({
      actorId: session.userId,
      action: "admin.support.view_pdf",
      targetUserId: receipt.user_id,
      entityType: "receipt",
      entityId: receipt.id,
      metadata: { number: receipt.number, version: version.version_no, download },
    });
  }

  return new NextResponse(file.stream(), {
    headers: {
      ...noStore,
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      // file_name é validado no banco: só [a-z0-9-].pdf.
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
    },
  });
}
