import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import type { SavedProcessing } from "@/features/assets/components/signature-editor";
import { ProfessionalProfileForm } from "@/features/profile/components/professional-profile-form";
import { ProfileLogo, ProfileSignature } from "@/features/profile/components/profile-assets";
import { requireOnboardedUser } from "@/features/profile/guards";
import { getSourceAsset, signedAssetUrl } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const { userId, professional } = await requireOnboardedUser();

  const [logoUrl, signatureUrl, signatureOriginal] = await Promise.all([
    signedAssetUrl(professional.logo),
    signedAssetUrl(professional.signature),
    getSourceAsset(professional.signature),
  ]);
  const signatureOriginalUrl = await signedAssetUrl(signatureOriginal);

  const card = "rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:p-6";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Perfil profissional" description="Esses dados aparecem automaticamente nos seus recibos." />

      <section aria-labelledby="dados-title" className={card}>
        <h2 id="dados-title" className="mb-4 text-lg font-semibold text-slate-900">
          Dados profissionais
        </h2>
        <ProfessionalProfileForm
          intent="profile"
          initial={{
            fullName: professional.full_name,
            companyName: professional.company_name ?? "",
            profession: professional.profession ?? "",
            council: professional.council ?? "",
            registrationNumber: professional.registration_number ?? "",
            document: professional.document_number ?? "",
            phone: professional.phone ?? "",
            city: professional.city ?? "",
            state: professional.state ?? "",
          }}
        />
      </section>

      <section aria-labelledby="logo-title" className={card}>
        <h2 id="logo-title" className="mb-4 text-lg font-semibold text-slate-900">
          Logo
        </h2>
        <ProfileLogo userId={userId} currentUrl={logoUrl} />
      </section>

      <section aria-labelledby="assinatura-title" className={card}>
        <h2 id="assinatura-title" className="mb-4 text-lg font-semibold text-slate-900">
          Assinatura e carimbo
        </h2>
        <ProfileSignature
          userId={userId}
          currentUrl={signatureUrl}
          originalUrl={signatureOriginalUrl}
          savedProcessing={(professional.signature?.processing as SavedProcessing) ?? null}
        />
      </section>
    </div>
  );
}
