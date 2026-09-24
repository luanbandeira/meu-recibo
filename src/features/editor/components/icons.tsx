// Ícones simples (traço), sem dependência. aria-hidden: o botão tem rótulo próprio.

const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icons = {
  undo: () => <svg {...base} aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>,
  redo: () => <svg {...base} aria-hidden="true"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>,
  alignLeft: () => <svg {...base} aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h14" /></svg>,
  alignCenter: () => <svg {...base} aria-hidden="true"><path d="M4 6h16M7 12h10M5 18h14" /></svg>,
  alignRight: () => <svg {...base} aria-hidden="true"><path d="M4 6h16M10 12h10M6 18h14" /></svg>,
  alignJustify: () => <svg {...base} aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  bulletList: () => <svg {...base} aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg>,
  orderedList: () => <svg {...base} aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10M4 5h1v4M4 9h2M4 15.5a1 1 0 0 1 2 0c0 1-2 1.5-2 3h2" /></svg>,
  line: () => <svg {...base} aria-hidden="true"><path d="M3 12h18" /></svg>,
  variable: () => <svg {...base} aria-hidden="true"><path d="M8 4c-2 0-2 2-2 4s-2 4-2 4 2 2 2 4 0 4 2 4M16 4c2 0 2 2 2 4s2 4 2 4-2 2-2 4 0 4-2 4" /></svg>,
  header: () => <svg {...base} aria-hidden="true"><rect x="3" y="4" width="6" height="6" rx="1" /><path d="M12 5h9M12 9h6M3 14h18" /></svg>,
  image: () => <svg {...base} aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>,
  signature: () => <svg {...base} aria-hidden="true"><path d="M3 17c3 0 4-8 6-8s0 8 3 8 3-4 5-4 2 2 4 2M3 21h18" /></svg>,
  page: () => <svg {...base} aria-hidden="true"><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /></svg>,
};
