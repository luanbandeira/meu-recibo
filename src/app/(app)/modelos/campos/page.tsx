import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { listFields } from "@/features/fields/queries";
import { requireOnboardedUser } from "@/features/profile/guards";
import { FieldsManager } from "./fields-manager";

export const metadata: Metadata = { title: "Campos" };

export default async function FieldsPage() {
  const { userId } = await requireOnboardedUser();
  const fields = await listFields(userId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Campos de emissão"
        description="São as informações pedidas ao emitir um recibo. Cada modelo usa só os campos que aparecem nele."
        back={{ href: "/modelos", label: "Modelos" }}
      />
      <FieldsManager initialFields={fields} />
    </div>
  );
}
