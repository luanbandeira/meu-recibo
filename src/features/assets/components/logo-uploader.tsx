"use client";

/* eslint-disable @next/next/no-img-element -- URLs assinadas/blob privadas e temporárias, sem otimização do Next */

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { removeLogo } from "@/features/profile/actions";
import { registerAsset } from "../actions";
import {
  decodeImage,
  prepareOriginal,
  processImage,
  uploadAssetFiles,
  validateImageFile,
  type ProcessedImage,
} from "../client-image";
import { Checkerboard } from "./checkerboard";

type Draft = { file: File; original: { blob: Blob; ext: string }; processed: ProcessedImage };

export function LogoUploader({
  userId,
  currentUrl,
  onSaved,
}: {
  userId: string;
  currentUrl: string | null;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"reading" | "saving" | "removing" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const invalid = validateImageFile(file);
    if (invalid) return setError(invalid);
    setBusy("reading");
    try {
      const bitmap = await decodeImage(file);
      const [original, processed] = await Promise.all([
        prepareOriginal(file, bitmap, "logo"),
        processImage(bitmap, "logo"),
      ]);
      setDraft({ file, original, processed });
    } catch {
      setError("Não foi possível ler esta imagem. Tente outro arquivo.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function save() {
    if (!draft) return;
    setBusy("saving");
    setError(null);
    try {
      const paths = await uploadAssetFiles({ userId, kind: "logo", original: draft.original, processed: draft.processed.blob });
      const result = await registerAsset({ kind: "logo", ...paths, processing: {} });
      if (!result.ok) throw new Error(result.error);
      URL.revokeObjectURL(draft.processed.url);
      setDraft(null);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("removing");
    const result = await removeLogo();
    setBusy(null);
    if (result.ok) onSaved();
    else setError("Não foi possível remover a logo.");
  }

  const preview = draft?.processed.url ?? currentUrl;

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}

      <Checkerboard className="h-40 p-4">
        {preview ? (
          <img src={preview} alt={draft ? "Prévia da nova logo" : "Logo atual"} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-sm text-slate-500">Nenhuma logo enviada</p>
        )}
      </Checkerboard>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        id="logo-file"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {draft ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={save} pending={busy === "saving"}>
            {busy === "saving" ? "Salvando…" : "Salvar logo"}
          </Button>
          <Button variant="ghost" disabled={busy === "saving"} onClick={() => setDraft(null)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant={currentUrl ? "secondary" : "primary"} pending={busy === "reading"} onClick={() => inputRef.current?.click()}>
            {currentUrl ? "Trocar logo" : "Escolher imagem da logo"}
          </Button>
          {currentUrl && (
            <Button variant="ghost" className="text-red-700" pending={busy === "removing"} onClick={remove}>
              Remover logo
            </Button>
          )}
        </div>
      )}
      <p className="text-xs text-slate-500">PNG, JPG ou WEBP. Logos com fundo transparente ficam melhores no recibo.</p>
    </div>
  );
}
