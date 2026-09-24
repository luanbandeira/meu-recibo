import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { requireUser } from "@/features/auth/session";
import { completeOnboarding } from "@/features/profile/actions";
import { ProfessionalProfileForm } from "@/features/profile/components/professional-profile-form";
import { ProfileLogo, ProfileSignature } from "@/features/profile/components/profile-assets";
import { getProfessionalProfile, getSourceAsset, signedAssetUrl } from "@/features/profile/queries";
import type { SavedProcessing } from "@/features/assets/components/signature-editor";
import { PresetPicker } from "@/features/templates/components/preset-picker";

export const metadata: Metadata = { title: "Configuração inicial" };

const steps = ["Seus dados", "Logo", "Assinatura", "Modelo"];

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { userId, profile } = await requireUser();
  const professional = await getProfessionalProfile(userId);
  if (professional?.onboarding_completed_at) redirect("/dashboard");

  const requested = Number((await searchParams).etapa) || 1;
  // Logo e assinatura só depois dos dados profissionais salvos.
  const step = professional ? Math.min(Math.max(requested, 1), 4) : 1;

  const [logoUrl, signatureUrl, signatureOriginal] = await Promise.all([
    signedAssetUrl(professional?.logo ?? null),
    signedAssetUrl(professional?.signature ?? null),
    getSourceAsset(professional?.signature ?? null),
  ]);
  const signatureOriginalUrl = await signedAssetUrl(signatureOriginal);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-slate-600">Olá, {profile.display_name}!</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Vamos configurar seus recibos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Você preenche uma vez e esses dados entram automaticamente em todos os recibos.
        </p>
      </div>

      <ol className="grid grid-cols-4 gap-2" aria-label="Etapas">
        {steps.map((label, index) => {
          const number = index + 1;
          const state = number < step ? "done" : number === step ? "current" : "todo";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex flex-col gap-1.5">
              <span className={`h-1.5 rounded-full ${state === "todo" ? "bg-slate-200" : "bg-brand-600"}`} />
              <span className={`text-xs ${state === "current" ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                {number}. {label}
                {state === "done" && <span className="sr-only"> (concluída)</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <section className="rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:p-6">
        {step === 1 && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Seus dados profissionais</h2>
            <ProfessionalProfileForm
              intent="onboarding"
              initial={{
                fullName: professional?.full_name ?? profile.display_name,
                companyName: professional?.company_name ?? "",
                profession: professional?.profession ?? "",
                council: professional?.council ?? "",
                registrationNumber: professional?.registration_number ?? "",
                document: professional?.document_number ?? "",
                phone: professional?.phone ?? "",
                city: professional?.city ?? "",
                state: professional?.state ?? "",
              }}
            />
          </>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Sua logo</h2>
              <p className="text-sm text-slate-600">Aparece no cabeçalho do recibo. Se não tiver, pode pular.</p>
            </div>
            <ProfileLogo userId={userId} currentUrl={logoUrl} onSavedHref="/onboarding?etapa=3" />
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
              <LinkButton href="/onboarding?etapa=1" variant="ghost">
                ← Voltar
              </LinkButton>
              <LinkButton href="/onboarding?etapa=3" variant={logoUrl ? "primary" : "secondary"}>
                {logoUrl ? "Continuar" : "Pular por enquanto"}
              </LinkButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Assinatura e carimbo</h2>
              <p className="text-sm text-slate-600">
                Envie uma foto da sua assinatura com o carimbo. O fundo pode ser removido automaticamente.
              </p>
            </div>
            <ProfileSignature
              userId={userId}
              currentUrl={signatureUrl}
              originalUrl={signatureOriginalUrl}
              savedProcessing={(professional?.signature?.processing as SavedProcessing) ?? null}
            />
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
              <LinkButton href="/onboarding?etapa=2" variant="ghost">
                ← Voltar
              </LinkButton>
              <LinkButton href="/onboarding?etapa=4" variant={signatureUrl ? "primary" : "secondary"}>
                {signatureUrl ? "Continuar" : "Pular por enquanto"}
              </LinkButton>
            </div>
          </div>
        )}

        {step === 4 && (
          <form action={completeOnboarding} className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Seu modelo de recibo</h2>
              <p className="text-sm text-slate-600">
                Escolha o texto que mais combina com o seu trabalho. Depois você edita à vontade em Modelos.
              </p>
            </div>
            <PresetPicker />
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
              <LinkButton href="/onboarding?etapa=3" variant="ghost">
                ← Voltar
              </LinkButton>
              <Button type="submit">Concluir configuração</Button>
            </div>
          </form>
        )}
      </section>

      <p className="text-center text-xs text-slate-500">Tudo isso pode ser alterado depois em Perfil.</p>
    </div>
  );
}
