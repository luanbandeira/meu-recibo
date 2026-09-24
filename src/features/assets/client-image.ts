"use client";

import { createClient } from "@/lib/supabase/browser";
import { removeBackground, trimTransparent, type RgbaImage } from "./background-removal";
import { ACCEPTED_IMAGE_TYPES, ASSET_LIMITS, ORIGINAL_MAX_SIDE, type AssetKind } from "./limits";

/** Fotos de celular podem ser grandes; reduzimos antes de enviar. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export type PixelCrop = { x: number; y: number; width: number; height: number };

export type ProcessOptions = {
  crop?: PixelCrop;
  rotation?: number;
  removeBackground?: boolean;
  sensitivity?: number;
  darken?: boolean;
};

export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Use uma imagem PNG, JPG ou WEBP.";
  }
  if (file.size > MAX_INPUT_BYTES) return "Imagem muito grande (máximo 25 MB).";
  return null;
}

/** Decodifica aplicando a orientação EXIF (fotos "deitadas" do celular). */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Seu navegador não permitiu processar a imagem.");
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar a imagem."))), type, quality),
  );
}

function scaleToFit(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Arquivo "original" a guardar: o próprio arquivo, se couber no limite do
 * bucket; senão, uma cópia reduzida (sem nenhum outro tratamento).
 */
export async function prepareOriginal(file: File, bitmap: ImageBitmap, kind: AssetKind) {
  const { maxBytes } = ASSET_LIMITS[kind];
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type] ?? "png";
  if (file.size <= maxBytes) return { blob: file as Blob, ext };

  const size = scaleToFit(bitmap.width, bitmap.height, ORIGINAL_MAX_SIDE);
  const { canvas, context } = canvasOf(size.width, size.height);
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const pngBlob = file.type === "image/png" ? await toBlob(canvas, "image/png") : null;
  if (pngBlob && pngBlob.size <= maxBytes) return { blob: pngBlob, ext: "png" };
  return { blob: await toBlob(canvas, "image/jpeg", 0.9), ext: "jpg" };
}

/** Desenha a imagem girada (múltiplos de 90°) e recorta a área escolhida. */
function cropAndRotate(bitmap: ImageBitmap, crop: PixelCrop | undefined, rotation: number) {
  const turns = (((rotation / 90) % 4) + 4) % 4;
  const rotatedWidth = turns % 2 ? bitmap.height : bitmap.width;
  const rotatedHeight = turns % 2 ? bitmap.width : bitmap.height;

  const rotated = canvasOf(rotatedWidth, rotatedHeight);
  rotated.context.translate(rotatedWidth / 2, rotatedHeight / 2);
  rotated.context.rotate((turns * Math.PI) / 2);
  rotated.context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  const area = crop ?? { x: 0, y: 0, width: rotatedWidth, height: rotatedHeight };
  const out = canvasOf(area.width, area.height);
  out.context.drawImage(rotated.canvas, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return out.canvas;
}

export type ProcessedImage = { blob: Blob; url: string; width: number; height: number };

/** Gera o PNG final (usado no recibo): recorte, redução, remoção de fundo e margem justa. */
export async function processImage(bitmap: ImageBitmap, kind: AssetKind, options: ProcessOptions = {}): Promise<ProcessedImage> {
  const cropped = cropAndRotate(bitmap, options.crop, options.rotation ?? 0);
  const size = scaleToFit(cropped.width, cropped.height, ASSET_LIMITS[kind].processedMaxSide);
  const { canvas, context } = canvasOf(size.width, size.height);
  context.drawImage(cropped, 0, 0, size.width, size.height);

  let pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  let image: RgbaImage = { data: pixels.data, width: pixels.width, height: pixels.height };
  if (options.removeBackground) {
    image = removeBackground(image, { sensitivity: options.sensitivity, darken: options.darken });
  }
  image = trimTransparent(image);

  const result = canvasOf(image.width, image.height);
  pixels = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  result.context.putImageData(pixels, 0, 0);
  const blob = await toBlob(result.canvas, "image/png");
  return { blob, url: URL.createObjectURL(blob), width: image.width, height: image.height };
}

/** Envia original + processado para a pasta do usuário no bucket privado. */
export async function uploadAssetFiles(params: {
  userId: string;
  kind: AssetKind;
  original: { blob: Blob; ext: string };
  processed: Blob;
}) {
  const supabase = createClient();
  const bucket = ASSET_LIMITS[params.kind].bucket;
  const originalPath = `${params.userId}/${crypto.randomUUID()}.${params.original.ext}`;
  const processedPath = `${params.userId}/${crypto.randomUUID()}.png`;
  const contentTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

  const [a, b] = await Promise.all([
    supabase.storage.from(bucket).upload(originalPath, params.original.blob, {
      contentType: contentTypes[params.original.ext],
      upsert: false,
    }),
    supabase.storage.from(bucket).upload(processedPath, params.processed, { contentType: "image/png", upsert: false }),
  ]);
  if (a.error || b.error) throw new Error("Falha no envio. Verifique sua conexão e tente novamente.");
  return { originalPath, processedPath };
}
