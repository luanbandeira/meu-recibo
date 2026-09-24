import type { ReactNode } from "react";

/** Fundo quadriculado: deixa visível o que é transparente na imagem. */
export function Checkerboard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-xl ring-1 ring-inset ring-slate-200 ${className}`}
      style={{
        backgroundColor: "#fff",
        backgroundImage:
          "linear-gradient(45deg, #eef1f5 25%, transparent 25%), linear-gradient(-45deg, #eef1f5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eef1f5 75%), linear-gradient(-45deg, transparent 75%, #eef1f5 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
      }}
    >
      {children}
    </div>
  );
}
