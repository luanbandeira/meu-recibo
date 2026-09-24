import { AppHeader } from "@/components/app-header";
import { SectionNav } from "@/components/section-nav";
import { requireOnboardedUser } from "@/features/profile/guards";

export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireOnboardedUser();

  return (
    <>
      <AppHeader homeHref="/dashboard" userLabel={profile.display_name} />
      <SectionNav
        label="Principal"
        items={[
          { href: "/dashboard", label: "Início" },
          { href: "/perfil", label: "Perfil" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
