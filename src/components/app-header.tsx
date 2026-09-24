import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

export function AppHeader({ homeHref, userLabel }: { homeHref: string; userLabel: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href={homeHref} className="rounded-lg" aria-label="Início">
          <BrandMark />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden truncate text-sm text-slate-600 sm:inline">{userLabel}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
