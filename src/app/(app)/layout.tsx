import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/features/auth/session";

export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  return (
    <>
      <AppHeader homeHref="/dashboard" userLabel={profile.display_name} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
