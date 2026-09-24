export type AssetKind = "logo" | "signature";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

// Iguais aos limites configurados nos buckets (migration de storage).
export const ASSET_LIMITS: Record<AssetKind, { bucket: "logos" | "signatures"; maxBytes: number; processedMaxSide: number }> = {
  logo: { bucket: "logos", maxBytes: 2 * 1024 * 1024, processedMaxSide: 1000 },
  signature: { bucket: "signatures", maxBytes: 5 * 1024 * 1024, processedMaxSide: 1600 },
};

/** Lado máximo do "original" guardado quando a foto enviada é maior que o limite. */
export const ORIGINAL_MAX_SIDE = 2400;
export const MIN_SIDE = 40;
export const MAX_SIDE = 8000;
