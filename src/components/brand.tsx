export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-slate-900 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-brand-600" />
        <path d="M10 8h9l4 4v12H10z" fill="white" />
        <path d="M19 8v4h4" fill="none" stroke="#bdd3ff" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M13 16h7M13 19h7M13 22h4" stroke="#2149ec" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="text-lg">
        Meu<span className="text-brand-600">Recibo</span>
      </span>
    </span>
  );
}
