import { SectionNav } from "@/components/section-nav";

export function AdminNav() {
  return (
    <SectionNav
      label="Administração"
      items={[
        { href: "/admin", label: "Visão geral", exact: true },
        { href: "/admin/usuarios", label: "Usuários" },
        { href: "/admin/auditoria", label: "Auditoria" },
      ]}
    />
  );
}
