import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import type { SavedProcessing } from "@/features/assets/components/signature-editor";
import { ProfessionalProfileForm } from "@/features/profile/components/professional-profile-form";
import { ProfileLogo, ProfileSignature } from "@/features/profile/components/profile-assets";
import { requireOnboardedUser } from "@/features/profile/guards";
import { getSourceAsset, signedAssetUrl, type ProfessionalProfile } from "@/features/profile/queries";
import { formatCpfCnpj, formatPhone } from "@/lib/format/br";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const { userId, professional, support } = await requireOnboardedUser({ allowSupport: true });

  const [logoUrl, signatureUrl, signatureOriginal] = await Promise.all([
    signedAssetUrl(professional.logo),
    signedAssetUrl(professional.signature),
    getSourceAsset(professional.signature),
  ]);
  const signatureOriginalUrl = await signedAssetUrl(signatureOriginal);

  const card = "rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:p-6";

  if (support) {
    return <ReadOnlyProfile professional={professional} logoUrl={logoUrl} signatureUrl={signatureUrl} card={card} />;
  }

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

/** Modo suporte: os mesmos dados, sem formulários. */
function ReadOnlyProfile({
  professional,
  logoUrl,
  signatureUrl,
  card,
}: {
  professional: ProfessionalProfile;
  logoUrl: string | null;
  signatureUrl: string | null;
  card: string;
}) {
  const rows: [string, string | null][] = [
    ["Nome completo", professional.full_name],
    ["Nome da empresa", professional.company_name],
    ["Profissão", professional.profession],
    ["Conselho", professional.council],
    ["Registro", professional.registration_number],
    [professional.document_type === "cnpj" ? "CNPJ" : "CPF", professional.document_number && formatCpfCnpj(professional.document_number)],
    ["Telefone", professional.phone && formatPhone(professional.phone)],
    ["Cidade", [professional.city, professional.state].filter(Boolean).join(" - ") || null],
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Perfil profissional" description="Somente leitura no modo de suporte." />
      <section aria-labelledby="dados-title" className={card}>
        <h2 id="dados-title" className="mb-4 text-lg font-semibold text-slate-900">
          Dados profissionais
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-0.5 break-words text-sm text-slate-900">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="imagens-title" className={card}>
        <h2 id="imagens-title" className="mb-4 text-lg font-semibold text-slate-900">
          Logo e assinatura
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Logo", logoUrl],
            ["Assinatura e carimbo", signatureUrl],
          ].map(([label, url]) => (
            <figure key={label} className="flex flex-col gap-2">
              <figcaption className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</figcaption>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária de arquivo privado
                <img src={url} alt={label ?? ""} className="max-h-40 w-auto self-start rounded-lg object-contain ring-1 ring-slate-200" />
              ) : (
                <p className="text-sm text-slate-500">Não enviada.</p>
              )}
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
