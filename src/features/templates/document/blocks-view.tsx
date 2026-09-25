/* eslint-disable @next/next/no-img-element -- imagens privadas com URL assinada temporária */

import type { ReactNode } from "react";
import { IMAGE_SIZES, type HeaderLayout, type ImageSize } from "./constants";
import { headerLines, signatureDocumentLine, type DocumentProfile } from "./profile-values";
import { signatureRows, type Signer } from "./signatures";

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

/** Rótulo de um campo para mostrar no editor: "[Nome do pagador]". */
function fieldPlaceholder(key: string, fieldLabels: Record<string, string>) {
  return `[${fieldLabels[key] ?? key}]`;
}

export function SignatureBlockView({
  size,
  align,
  signers,
  profile,
  assets,
  fieldLabels,
  showPlaceholders = true,
}: {
  size: ImageSize;
  align: BlockAlign;
  signers: Signer[];
  profile: DocumentProfile;
  assets: DocumentAssets;
  fieldLabels: Record<string, string>;
  showPlaceholders?: boolean;
}) {
  const lines = headerLines(profile);
  const rows = signatureRows(signers);
  const columnPt = IMAGE_SIZES[size].signaturePt + 60;

  const columnWidth = (count: number) =>
    count > 1 ? `min(calc(${columnPt} * var(--pt)), calc((100% - ${count - 1} * 24 * var(--pt)) / ${count}))` : `calc(${columnPt} * var(--pt))`;

  return (
    <div className="flex flex-col gap-[calc(20*var(--pt))]">
      {rows.map((row, r) => (
        // Grade de 2 linhas: a área de assinar de todos da linha tem a mesma
        // altura, então as linhas ficam alinhadas (como no PDF).
        <div
          key={r}
          className={`grid grid-flow-col grid-rows-[auto_auto] gap-x-[calc(24*var(--pt))] ${signers.length === 1 ? { left: "justify-start", center: "justify-center", right: "justify-end" }[align] : "justify-around"}`}
          style={{ gridTemplateColumns: `repeat(${row.length}, ${columnWidth(row.length)})` }}
        >
          {row.flatMap((signer, i) => {
            const digital = signer.who === "me" && signer.mode === "digital";
            const name =
              signer.who === "me"
                ? signer.showName ? lines.name : null
                : signer.name.from === "field"
                  ? fieldPlaceholder(signer.name.key, fieldLabels)
                  : signer.name.from === "text"
                    ? signer.name.text || null
                    : null;
            const detail =
              signer.who === "me"
                ? signer.showName ? signatureDocumentLine(profile) : null
                : signer.documentKey ? `CPF/CNPJ: ${fieldPlaceholder(signer.documentKey, fieldLabels)}` : null;
            const showLine = !digital || !assets.signatureUrl || Boolean(name || detail || signer.caption);
            return [
              <div key={`${i}-area`} className="flex min-w-0 items-end justify-center" style={{ minHeight: `calc(40 * var(--pt))` }}>
                {digital && assets.signatureUrl ? (
                  <img src={assets.signatureUrl} alt="Assinatura" style={{ width: `calc(${IMAGE_SIZES[size].signaturePt} * var(--pt))`, maxWidth: "100%" }} className="h-auto object-contain" />
                ) : digital && showPlaceholders ? (
                  <Placeholder>Sua assinatura (envie em Perfil)</Placeholder>
                ) : null}
              </div>,
              <div key={`${i}-texto`} className="min-w-0">
                {showLine && (
                  <div className="mt-[calc(2*var(--pt))] w-full border-t border-slate-800 pt-[calc(2*var(--pt))] text-center" style={{ fontSize: "calc(10 * var(--pt))" }}>
                    {name && <div className="font-semibold">{name}</div>}
                    {detail && <div>{detail}</div>}
                    {signer.caption && <div className="text-slate-600" style={{ fontSize: "calc(9 * var(--pt))" }}>{signer.caption}</div>}
                  </div>
                )}
              </div>,
            ];
          })}
        </div>
      ))}
    </div>
  );
}
