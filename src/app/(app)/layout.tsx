import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/mobile-nav";
import { SectionNav } from "@/components/section-nav";
import { requireOnboardedUser } from "@/features/profile/guards";
import { SupportBanner } from "@/features/support/components/support-banner";

export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  // O layout aceita o modo suporte; cada página decide se é de consulta.
  const { profile, support } = await requireOnboardedUser({ allowSupport: true });
  const readOnly = Boolean(support);

  const sections = [
    { href: "/dashboard", label: "Início" },
    ...(readOnly ? [] : [{ href: "/emitir", label: "Emitir recibo" }]),
    { href: "/recibos", label: readOnly ? "Recibos" : "Meus recibos" },
    { href: "/modelos", label: "Modelos" },
    { href: "/perfil", label: "Perfil" },
  ];

  return (
    <>
      <AppHeader
        homeHref="/dashboard"
        userLabel={support ? `${profile.display_name} · Suporte` : profile.display_name}
        banner={support && <SupportBanner support={support} area="app" />}
      />
      <div className="hidden sm:block">
        <SectionNav label="Principal" items={sections} />
      </div>
      {/* pb-28 no celular: espaço para a navegação inferior */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:pb-8">{children}</main>
      <MobileNav readOnly={readOnly} />
    </>
  );
}
