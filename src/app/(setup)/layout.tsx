import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/features/auth/session";

// Configuração inicial: exige usuário ativo com senha definitiva, mas ainda
// não exige o perfil completo (é aqui que ele é preenchido).
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  return (
    <>
      <AppHeader homeHref="/onboarding" userLabel={profile.display_name} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
