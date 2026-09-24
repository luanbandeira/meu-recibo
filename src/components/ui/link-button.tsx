import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
};

/** Link com aparência de botão (navegação, não ação). */
export function LinkButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: LinkProps & { variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
