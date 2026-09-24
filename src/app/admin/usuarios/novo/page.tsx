import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireSuperAdmin } from "@/features/auth/session";
import { CreateUserForm } from "./create-user-form";

export const metadata: Metadata = { title: "Criar usuário" };

export default async function NewUserPage() {
  await requireSuperAdmin();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <PageHeader
        title="Criar usuário"
        description="A pessoa recebe um usuário e uma senha temporária, e cria a própria senha no primeiro acesso."
        back={{ href: "/admin/usuarios", label: "Usuários" }}
      />
      <CreateUserForm />
    </div>
  );
}
