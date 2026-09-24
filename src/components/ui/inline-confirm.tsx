"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "./button";

/**
 * Confirmação no próprio lugar (sem modal): o botão abre um painel com a
 * explicação da consequência e os botões Cancelar / Confirmar.
 */
export function InlineConfirm({
  trigger,
  title,
  description,
  confirmLabel,
  tone = "primary",
  pending,
  onConfirm,
}: {
  trigger: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  pending?: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!open) {
    return (
      <Button
        variant="secondary"
        className={tone === "danger" ? "text-red-700" : ""}
        aria-expanded={false}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>
    );
  }

  return (
    <div
      id={panelId}
      role="group"
      aria-label={title}
      className={`flex flex-col gap-3 rounded-xl p-4 ring-1 ring-inset ${
        tone === "danger" ? "bg-red-50 ring-red-200" : "bg-brand-50 ring-brand-200"
      }`}
    >
      <p className="font-medium text-slate-900">{title}</p>
      <div className="text-sm text-slate-700">{description}</div>
      <div className="flex flex-wrap gap-2">
        <Button variant={tone === "danger" ? "danger" : "primary"} pending={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
