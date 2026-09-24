import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedUser } from "@/features/profile/guards";
import { ReceiptCard } from "@/features/receipts/components/receipt-card";
import { listRecentReceipts } from "@/features/receipts/queries";

export const metadata: Metadata = { title: "Meus recibos" };

export default async function ReceiptsPage() {
  const { userId } = await requireOnboardedUser();
  const receipts = await listRecentReceipts(userId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Meus recibos" actions={<LinkButton href="/emitir">+ Emitir</LinkButton>} />
      {receipts.length === 0 ? (
        <EmptyState
          title="Você ainda não emitiu nenhum recibo."
          action={<LinkButton href="/emitir">Emitir primeiro recibo</LinkButton>}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <ReceiptCard receipt={receipt} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
