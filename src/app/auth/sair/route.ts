import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Encerra a sessão de contas desativadas e volta ao login com a explicação.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const loginUrl = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("erro") === "conta-desativada") {
    loginUrl.searchParams.set("erro", "conta-desativada");
  }
  return NextResponse.redirect(loginUrl);
}
