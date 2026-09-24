import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UF } from "@/lib/format/br";

export type AssetRef = {
  id: string;
  bucket: "logos" | "signatures";
  storage_path: string;
  width: number;
  height: number;
  source_asset_id: string | null;
  processing: Record<string, unknown>;
};

export type ProfessionalProfile = {
  user_id: string;
  full_name: string;
  company_name: string | null;
  profession: string | null;
  council: string | null;
  registration_number: string | null;
  document_type: "cpf" | "cnpj" | null;
  document_number: string | null;
  phone: string | null;
  city: string | null;
  state: UF | null;
  onboarding_completed_at: string | null;
  logo: AssetRef | null;
  signature: AssetRef | null;
};

const ASSET_COLUMNS = "id, bucket, storage_path, width, height, source_asset_id, processing";

/** Perfil profissional do usuário (RLS garante que é o próprio). */
export const getProfessionalProfile = cache(async (userId: string): Promise<ProfessionalProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select(
      `user_id, full_name, company_name, profession, council, registration_number, document_type,
       document_number, phone, city, state, onboarding_completed_at,
       logo:user_assets!professional_profiles_logo_fk(${ASSET_COLUMNS}),
       signature:user_assets!professional_profiles_signature_fk(${ASSET_COLUMNS})`,
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`professional_profiles: ${error.code}`);
  return data as unknown as ProfessionalProfile | null;
});

/** URL temporária (10 min) para exibir um arquivo privado do próprio usuário. */
export async function signedAssetUrl(asset: Pick<AssetRef, "bucket" | "storage_path"> | null) {
  if (!asset) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(asset.bucket).createSignedUrl(asset.storage_path, 600);
  return data?.signedUrl ?? null;
}

/** Arquivo original de um asset processado (para reeditar a assinatura). */
export async function getSourceAsset(asset: AssetRef | null): Promise<AssetRef | null> {
  if (!asset?.source_asset_id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_assets")
    .select(ASSET_COLUMNS)
    .eq("id", asset.source_asset_id)
    .maybeSingle();
  return data as AssetRef | null;
}
