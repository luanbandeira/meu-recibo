"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Elemento à direita dentro do campo (ex.: botão mostrar senha). */
  trailing?: ReactNode;
};

export function TextField({ label, hint, error, trailing, id, className = "", ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className={[
            // text-base (16px) evita o zoom automático do iOS ao focar.
            "block min-h-12 w-full rounded-lg bg-white px-3.5 text-base text-slate-900 shadow-xs",
            "ring-1 ring-inset placeholder:text-slate-400 focus:outline-none focus:ring-2",
            error ? "ring-red-400 focus:ring-red-600" : "ring-slate-300 focus:ring-brand-600",
            trailing ? "pr-24" : "",
            className,
          ].join(" ")}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-sm text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-red-700">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="min-h-10 rounded-md px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      }
    />
  );
}
