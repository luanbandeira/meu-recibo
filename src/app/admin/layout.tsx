import { AppHeader } from "@/components/app-header";
import { requireSuperAdmin } from "@/features/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireSuperAdmin();

  return (
    <>
      <AppHeader homeHref="/admin" userLabel={`${profile.display_name} · Administrador`} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
