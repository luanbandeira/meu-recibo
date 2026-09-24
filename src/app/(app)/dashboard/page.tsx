import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { requireOnboardedUser } from "@/features/profile/guards";

export const metadata: Metadata = { title: "Início" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { professional } = await requireOnboardedUser();
  const welcome = (await searchParams)["bem-vindo"] === "1";
  const firstName = professional.full_name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">Olá, {firstName}</h1>
      {welcome && (
        <Alert tone="success">Configuração concluída! Seus dados já estão prontos para entrar nos recibos.</Alert>
      )}
      <Alert tone="info">
        A emissão de recibos chega na próxima fase. Enquanto isso, você já pode ajustar seus modelos em{" "}
        <Link href="/modelos" className="font-medium underline">
          Modelos
        </Link>{" "}
        e seus dados em{" "}
        <Link href="/perfil" className="font-medium underline">
          Perfil
        </Link>
        .
      </Alert>
    </div>
  );
}
