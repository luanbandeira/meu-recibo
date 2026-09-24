import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedUser } from "@/features/profile/guards";
import { NewTemplateForm } from "./new-template-form";

export const metadata: Metadata = { title: "Novo modelo" };

export default async function NewTemplatePage() {
  await requireOnboardedUser();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <PageHeader title="Novo modelo" back={{ href: "/modelos", label: "Modelos" }} />
      <NewTemplateForm />
    </div>
  );
}
