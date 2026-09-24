"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const items: { href: string; label: string; icon: ReactNode; primary?: boolean }[] = [
  { href: "/dashboard", label: "Início", icon: <svg {...icon} aria-hidden="true"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg> },
  { href: "/modelos", label: "Modelos", icon: <svg {...icon} aria-hidden="true"><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h7M9 17h5" /></svg> },
  { href: "/emitir", label: "Emitir", primary: true, icon: <svg {...icon} strokeWidth={2.5} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> },
  { href: "/perfil", label: "Perfil", icon: <svg {...icon} aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg> },
];

/** Navegação inferior no celular, com "Emitir" em destaque ao alcance do polegar. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  item.primary ? "text-brand-700" : active ? "text-brand-700" : "text-slate-600"
                }`}
              >
                {item.primary ? (
                  <span className="-mt-5 flex size-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-md ring-4 ring-white">
                    {item.icon}
                  </span>
                ) : (
                  item.icon
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
