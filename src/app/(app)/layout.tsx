import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/mobile-nav";
import { SectionNav } from "@/components/section-nav";
import { requireOnboardedUser } from "@/features/profile/guards";

export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireOnboardedUser();

  return (
    <>
      <AppHeader homeHref="/dashboard" userLabel={profile.display_name} />
      <div className="hidden sm:block">
        <SectionNav
          label="Principal"
          items={[
            { href: "/dashboard", label: "Início" },
            { href: "/emitir", label: "Emitir recibo" },
            { href: "/recibos", label: "Meus recibos" },
            { href: "/modelos", label: "Modelos" },
            { href: "/perfil", label: "Perfil" },
          ]}
        />
      </div>
      {/* pb-28 no celular: espaço para a navegação inferior */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:pb-8">{children}</main>
      <MobileNav />
    </>
  );
}
