"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readImageInfo, type ImageInfo } from "./image-validation";
import { ASSET_LIMITS, MAX_SIDE, MIN_SIDE, type AssetKind } from "./limits";

// O navegador envia os arquivos direto ao Storage privado (RLS: só na pasta
// do próprio usuário; bucket limita tipo e tamanho). Esta ação NÃO confia no
// que o cliente declarou: baixa os arquivos, confere os bytes reais, as
// dimensões e o dono, e só então registra e aplica ao perfil.

const pathSchema = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/);

const registerSchema = z.object({
  kind: z.enum(["logo", "signature"]),
  originalPath: pathSchema,
  processedPath: pathSchema,
  processing: z
    .object({
      crop: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
      rotation: z.number().int().min(-360).max(360).optional(),
      removeBackground: z.boolean().optional(),
      sensitivity: z.number().min(0).max(1).optional(),
      darken: z.boolean().optional(),
    })
    .strict(),
});

export type RegisterAssetInput = z.input<typeof registerSchema>;
export type RegisterAssetResult = { ok: true } | { ok: false; error: string };

const INVALID = "O arquivo enviado não é uma imagem válida (PNG, JPG ou WEBP).";

export async function registerAsset(input: RegisterAssetInput): Promise<RegisterAssetResult> {
  const { userId } = await requireUser();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados de envio inválidos." };
  const { kind, originalPath, processedPath, processing } = parsed.data;
  const { bucket, maxBytes, processedMaxSide } = ASSET_LIMITS[kind as AssetKind];

  const cleanup = () => createAdminClient().storage.from(bucket).remove([originalPath, processedPath]);

  if (!originalPath.startsWith(`${userId}/`) || !processedPath.startsWith(`${userId}/`)) {
    return { ok: false, error: "Arquivo inválido." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("professional_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) {
    await cleanup();
    return { ok: false, error: "Preencha seus dados profissionais antes de enviar imagens." };
  }

  async function inspect(path: string): Promise<(ImageInfo & { size: number }) | null> {
    const { data } = await supabase.storage.from(bucket).download(path);
    if (!data || data.size > maxBytes) return null;
    const info = readImageInfo(new Uint8Array(await data.arrayBuffer()));
    if (!info || info.width < MIN_SIDE || info.height < MIN_SIDE || info.width > MAX_SIDE || info.height > MAX_SIDE) {
      return null;
    }
    return { ...info, size: data.size };
  }

  const [original, processed] = await Promise.all([inspect(originalPath), inspect(processedPath)]);
  const processedOk =
    processed?.mime === "image/png" && Math.max(processed.width, processed.height) <= processedMaxSide;
  if (!original || !processed || !processedOk) {
    await cleanup();
    return { ok: false, error: INVALID };
  }

  const { data: originalRow, error: originalError } = await supabase
    .from("user_assets")
    .insert({
      user_id: userId,
      kind,
      variant: "original",
      bucket,
      storage_path: originalPath,
      mime_type: original.mime,
      size_bytes: original.size,
      width: original.width,
      height: original.height,
    })
    .select("id")
    .single();

  const { data: processedRow, error: processedError } = originalRow
    ? await supabase
        .from("user_assets")
        .insert({
          user_id: userId,
          kind,
          variant: "processed",
          source_asset_id: originalRow.id,
          bucket,
          storage_path: processedPath,
          mime_type: processed.mime,
          size_bytes: processed.size,
          width: processed.width,
          height: processed.height,
          processing,
        })
        .select("id")
        .single()
    : { data: null, error: originalError };

  if (originalError || processedError || !processedRow) {
    return { ok: false, error: "Não foi possível salvar a imagem. Tente novamente." };
  }

  const column = kind === "logo" ? "logo_asset_id" : "signature_asset_id";
  const { error: linkError } = await supabase
    .from("professional_profiles")
    .update({ [column]: processedRow.id })
    .eq("user_id", userId);
  if (linkError) return { ok: false, error: "Não foi possível aplicar a imagem ao seu perfil." };

  revalidatePath("/", "layout");
  return { ok: true };
}
