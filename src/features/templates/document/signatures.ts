// Assinaturas do recibo: um bloco com 1 a 4 pessoas. Regras puras, usadas
// igualmente pelo editor, pelo PDF e pelo formulário de emissão.
//
// - "Eu" (o profissional): nome e registro vêm do perfil; assina com a imagem
//   salva ("digital") ou fica a linha para assinar à mão ("manual"). Na
//   emissão, a pessoa pode trocar digital → à mão só naquele recibo.
// - "Outra pessoa": sempre à mão. O nome vem de um campo de emissão (ex.:
//   pagador), de um texto fixo do modelo ou fica em branco; CPF/CNPJ opcional.
//
// Blocos antigos (sem `signers`) continuam valendo como "só eu, digital".

export const MAX_SIGNERS = 4;
export const SIGNATURE_MODE_KEY = "assinatura_modo";

export type SignatureMode = "digital" | "manual";

export type MeSigner = { who: "me"; mode: SignatureMode; showName: boolean; caption: string | null };
export type OtherName = { from: "field"; key: string } | { from: "text"; text: string } | { from: "blank" };
export type OtherSigner = { who: "other"; name: OtherName; documentKey: string | null; caption: string | null };
export type Signer = MeSigner | OtherSigner;

export const ME_SIGNER: MeSigner = { who: "me", mode: "digital", showName: true, caption: null };

export function otherSigner(overrides: Partial<Omit<OtherSigner, "who">> = {}): OtherSigner {
  return { who: "other", name: { from: "blank" }, documentKey: null, caption: null, ...overrides };
}

/** Padrão de um bloco novo: você (digital) e quem paga (à mão). */
export const DEFAULT_NEW_SIGNERS: Signer[] = [
  ME_SIGNER,
  otherSigner({ name: { from: "field", key: "pagador" }, documentKey: "cpf_pagador", caption: "Pagador" }),
];

type SignatureAttrs = { signers?: unknown; showName?: unknown } | undefined;

/** Pessoas do bloco. Sem lista (bloco antigo) = só você, digital. */
export function signersOf(attrs: SignatureAttrs): Signer[] {
  if (Array.isArray(attrs?.signers) && attrs.signers.length > 0) return attrs.signers as Signer[];
  return [{ ...ME_SIGNER, showName: attrs?.showName !== false }];
}

/** Campos de emissão que as assinaturas usam (nome e documento de outras pessoas). */
export function signatureFieldKeys(signers: Signer[]): string[] {
  const keys: string[] = [];
  for (const signer of signers) {
    if (signer.who !== "other") continue;
    if (signer.name.from === "field") keys.push(signer.name.key);
    if (signer.documentKey) keys.push(signer.documentKey);
  }
  return keys;
}

/** O bloco usa a sua assinatura digital (imagem do Perfil)? */
export function usesDigitalSignature(signers: Signer[]): boolean {
  return signers.some((s) => s.who === "me" && s.mode === "digital");
}

/** Modo escolhido na emissão; recibos antigos (sem escolha) = digital. */
export function signatureModeOf(values: Record<string, unknown> | null | undefined): SignatureMode {
  return values?.[SIGNATURE_MODE_KEY] === "manual" ? "manual" : "digital";
}

/** Como a SUA assinatura sai neste recibo: digital só se o modelo pede, a emissão manteve e há imagem. */
export function effectiveMeMode(signer: MeSigner, chosen: SignatureMode, hasImage: boolean): SignatureMode {
  return signer.mode === "digital" && chosen === "digital" && hasImage ? "digital" : "manual";
}

/** Distribuição em linhas: 1–2 pessoas numa linha; 3–4 em duas linhas de até 2. */
export function signatureRows<T>(items: T[]): T[][] {
  if (items.length <= 2) return [items];
  return [items.slice(0, 2), items.slice(2, 4)];
}
