import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Administração" };

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">Administração</h1>
      <Alert tone="info">
        Acesso de administrador confirmado. O gerenciamento de usuários chega na Fase 2.
      </Alert>
    </div>
  );
}
