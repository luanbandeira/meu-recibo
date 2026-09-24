import type { ReactNode } from "react";

type Tone = "error" | "success" | "info";

const tones: Record<Tone, { box: string; icon: string }> = {
  error: { box: "bg-red-50 text-red-800 ring-red-200", icon: "⚠" },
  success: { box: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: "✓" },
  info: { box: "bg-brand-50 text-brand-900 ring-brand-200", icon: "ℹ" },
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const { box, icon } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex gap-2.5 rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${box}`}
    >
      <span aria-hidden="true" className="font-semibold">
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
}
