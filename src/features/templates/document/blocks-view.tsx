/* eslint-disable @next/next/no-img-element -- imagens privadas com URL assinada temporária */

import type { ReactNode } from "react";
import { IMAGE_SIZES, type HeaderLayout, type ImageSize } from "./constants";
import { headerLines, type DocumentProfile } from "./profile-values";

// Aparência dos blocos especiais — a MESMA no editor e na prévia.
// Medidas em var(--pt), iguais às do PDF.

export type DocumentAssets = { logoUrl: string | null; signatureUrl: string | null };
export type BlockAlign = "left" | "center" | "right";

const alignClass: Record<BlockAlign, string> = { left: "justify-start", center: "justify-center", right: "justify-end" };

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-dashed border-slate-300 px-3 py-2 font-sans text-[0.8em] text-slate-500">
      {children}
    </span>
  );
}

export function HeaderBlockView({
  layout,
  profile,
  assets,
  showPlaceholders = true,
}: {
  layout: HeaderLayout;
  profile: DocumentProfile;
  assets: DocumentAssets;
  showPlaceholders?: boolean;
}) {
  const lines = headerLines(profile);
  const showLogo = layout !== "no-logo";
  const logo = showLogo ? (
    assets.logoUrl ? (
      <img src={assets.logoUrl} alt="" style={{ height: `calc(${IMAGE_SIZES.medium.logoPt} * var(--pt))` }} className="w-auto max-w-[35%] object-contain" />
    ) : showPlaceholders ? (
      <Placeholder>Sua logo</Placeholder>
    ) : null
  ) : null;

  return (
    <div className={layout === "logo-left" ? "flex items-center gap-[calc(16*var(--pt))]" : "flex flex-col items-center gap-[calc(8*var(--pt))]"}>
      {logo}
      <div className={layout === "logo-left" ? "text-left" : "text-center"}>
        <div style={{ fontSize: "calc(18 * var(--pt))" }} className="font-bold leading-tight">
          {lines.name}
        </div>
        {lines.company && <div style={{ fontSize: "calc(10 * var(--pt))" }}>{lines.company}</div>}
        {lines.professionLine && <div style={{ fontSize: "calc(10.5 * var(--pt))" }}>{lines.professionLine}</div>}
        {lines.contactLine && <div style={{ fontSize: "calc(10.5 * var(--pt))" }}>{lines.contactLine}</div>}
      </div>
    </div>
  );
}

export function LogoBlockView({
  size,
  align,
  assets,
  showPlaceholders = true,
}: {
  size: ImageSize;
  align: BlockAlign;
  assets: DocumentAssets;
  showPlaceholders?: boolean;
}) {
  return (
    <div className={`flex ${alignClass[align]}`}>
      {assets.logoUrl ? (
        <img src={assets.logoUrl} alt="Logo" style={{ height: `calc(${IMAGE_SIZES[size].logoPt} * var(--pt))` }} className="w-auto object-contain" />
      ) : showPlaceholders ? (
        <Placeholder>Logo (envie em Perfil)</Placeholder>
      ) : null}
    </div>
  );
}

export function SignatureBlockView({
  size,
  align,
  showName,
  profile,
  assets,
  showPlaceholders = true,
}: {
  size: ImageSize;
  align: BlockAlign;
  showName: boolean;
  profile: DocumentProfile;
  assets: DocumentAssets;
  showPlaceholders?: boolean;
}) {
  const lines = headerLines(profile);
  return (
    <div className={`flex ${alignClass[align]}`}>
      <div className="flex flex-col items-center" style={{ width: `calc(${IMAGE_SIZES[size].signaturePt + 60} * var(--pt))` }}>
        {assets.signatureUrl ? (
          <img src={assets.signatureUrl} alt="Assinatura" style={{ width: `calc(${IMAGE_SIZES[size].signaturePt} * var(--pt))` }} className="h-auto object-contain" />
        ) : showPlaceholders ? (
          <Placeholder>Assinatura e carimbo (envie em Perfil)</Placeholder>
        ) : (
          <div style={{ height: `calc(40 * var(--pt))` }} />
        )}
        {showName && (
          <div className="mt-[calc(2*var(--pt))] w-full border-t border-slate-800 pt-[calc(2*var(--pt))] text-center" style={{ fontSize: "calc(10 * var(--pt))" }}>
            <div className="font-semibold">{lines.name}</div>
            {lines.professionLine && <div>{lines.professionLine}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
