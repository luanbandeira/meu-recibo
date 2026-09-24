"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Visão geral", exact: true },
  { href: "/admin/usuarios", label: "Usuários", exact: false },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administração" className="border-b border-slate-200 bg-white">
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap ${
                  active
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
