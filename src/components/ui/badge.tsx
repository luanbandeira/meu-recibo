import type { ReactNode } from "react";

type Tone = "success" | "neutral" | "warning" | "danger";

const tones: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
};

const dots: Record<Tone, string> = {
  success: "bg-emerald-500",
  neutral: "bg-slate-400",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

/** Sempre com texto: a cor nunca é o único indicador de estado. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dots[tone]}`} />
      {children}
    </span>
  );
}
