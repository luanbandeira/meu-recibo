"use client";

import { useRouter } from "next/navigation";
import { LogoUploader } from "@/features/assets/components/logo-uploader";
import { SignatureEditor, type SavedProcessing } from "@/features/assets/components/signature-editor";

// Envoltórios que recarregam os dados do servidor após salvar.

export function ProfileLogo({ userId, currentUrl, onSavedHref }: { userId: string; currentUrl: string | null; onSavedHref?: string }) {
  const router = useRouter();
  return (
    <LogoUploader
      userId={userId}
      currentUrl={currentUrl}
      onSaved={() => (onSavedHref ? router.push(onSavedHref) : router.refresh())}
    />
  );
}

export function ProfileSignature(props: {
  userId: string;
  currentUrl: string | null;
  originalUrl: string | null;
  savedProcessing: SavedProcessing | null;
}) {
  const router = useRouter();
  return <SignatureEditor {...props} onSaved={() => router.refresh()} />;
}
