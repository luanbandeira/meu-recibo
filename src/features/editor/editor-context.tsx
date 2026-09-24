"use client";

import { createContext, useContext } from "react";
import type { CatalogVariable } from "@/features/templates/document/variables";
import type { DocumentProfile } from "@/features/templates/document/profile-values";

export type EditorAssets = {
  logoUrl: string | null;
  signatureUrl: string | null;
};

export type EditorContextValue = {
  profile: DocumentProfile;
  assets: EditorAssets;
  catalog: CatalogVariable[];
  /** Nomes de todos os campos, inclusive arquivados (continuam válidos em modelos). */
  fieldLabels: Record<string, string>;
};

const EditorDataContext = createContext<EditorContextValue | null>(null);

export const EditorDataProvider = EditorDataContext.Provider;

/** Dados do perfil e catálogo, acessíveis dentro das NodeViews do TipTap. */
export function useEditorData(): EditorContextValue {
  const value = useContext(EditorDataContext);
  if (!value) throw new Error("useEditorData fora do EditorDataProvider");
  return value;
}
