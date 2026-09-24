import { AppHeader } from "@/components/app-header";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { requireSuperAdmin } from "@/features/auth/session";
import { SupportBanner } from "@/features/support/components/support-banner";
import { getActiveSupportSession } from "@/features/support/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireSuperAdmin();
  const support = await getActiveSupportSession();

  return (
    <>
      <AppHeader
        homeHref="/admin"
        userLabel={`${profile.display_name} · Administrador`}
        banner={support && <SupportBanner support={support} area="admin" />}
      />
      <AdminNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
