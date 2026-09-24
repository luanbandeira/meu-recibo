"use client";

/* eslint-disable @next/next/no-img-element -- URLs assinadas/blob privadas e temporárias, sem otimização do Next */

import { useEffect, useRef, useState } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { registerAsset } from "../actions";
import {
  decodeImage,
  prepareOriginal,
  processImage,
  uploadAssetFiles,
  validateImageFile,
  type PixelCrop,
  type ProcessedImage,
} from "../client-image";
import { Checkerboard } from "./checkerboard";

export type SavedProcessing = {
  crop?: PixelCrop;
  rotation?: number;
  removeBackground?: boolean;
  sensitivity?: number;
  darken?: boolean;
};

type Source = { file: File; bitmap: ImageBitmap };
type Step = "view" | "crop" | "adjust";

const FULL_CROP: PercentCrop = { unit: "%", x: 0, y: 0, width: 100, height: 100 };

function rotatedSize(bitmap: ImageBitmap, rotation: number) {
  const sideways = Math.abs(rotation / 90) % 2 === 1;
  return sideways ? { width: bitmap.height, height: bitmap.width } : { width: bitmap.width, height: bitmap.height };
}

async function rotatedPreviewUrl(bitmap: ImageBitmap, rotation: number) {
  const { width, height } = rotatedSize(bitmap, rotation);
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d")!;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(bitmap, (-bitmap.width * scale) / 2, (-bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ? URL.createObjectURL(blob) : "";
}

export function SignatureEditor({
  userId,
  currentUrl,
  originalUrl,
  savedProcessing,
  onSaved,
}: {
  userId: string;
  currentUrl: string | null;
  originalUrl: string | null;
  savedProcessing: SavedProcessing | null;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("view");
  const [source, setSource] = useState<Source | null>(null);
  const [rotation, setRotation] = useState(0);
  const [cropPreview, setCropPreview] = useState<string>("");
  const [crop, setCrop] = useState<PercentCrop>(FULL_CROP);
  const [removeBg, setRemoveBg] = useState(true);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [darken, setDarken] = useState(false);
  const [result, setResult] = useState<ProcessedImage | null>(null);
  const [busy, setBusy] = useState<"reading" | "processing" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prévia girada para a etapa de recorte.
  useEffect(() => {
    if (!source) return;
    let url = "";
    let cancelled = false;
    rotatedPreviewUrl(source.bitmap, rotation).then((u) => {
      url = u;
      if (!cancelled) setCropPreview(u);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, rotation]);

  function pixelCrop(): PixelCrop | undefined {
    if (!source) return undefined;
    const { width, height } = rotatedSize(source.bitmap, rotation);
    return {
      x: Math.round((crop.x / 100) * width),
      y: Math.round((crop.y / 100) * height),
      width: Math.max(1, Math.round((crop.width / 100) * width)),
      height: Math.max(1, Math.round((crop.height / 100) * height)),
    };
  }

  // Reprocessa (com pequena espera) sempre que um ajuste muda.
  useEffect(() => {
    if (step !== "adjust" || !source) return;
    const timer = setTimeout(async () => {
      setBusy("processing");
      try {
        const next = await processImage(source.bitmap, "signature", {
          crop: pixelCrop(),
          rotation,
          removeBackground: removeBg,
          sensitivity,
          darken,
        });
        setResult((previous) => {
          if (previous) URL.revokeObjectURL(previous.url);
          return next;
        });
      } catch {
        setError("Não foi possível processar a imagem.");
      } finally {
        setBusy(null);
      }
    }, 180);
    return () => clearTimeout(timer);
    // pixelCrop deriva de crop/rotation/source, já listados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, source, rotation, crop, removeBg, sensitivity, darken]);

  async function start(file: File, processing: SavedProcessing | null) {
    setError(null);
    const invalid = validateImageFile(file);
    if (invalid) return setError(invalid);
    setBusy("reading");
    try {
      const bitmap = await decodeImage(file);
      const nextRotation = processing?.rotation ?? 0;
      setSource({ file, bitmap });
      setRotation(nextRotation);
      setRemoveBg(processing?.removeBackground ?? true);
      setSensitivity(processing?.sensitivity ?? 0.5);
      setDarken(processing?.darken ?? false);
      if (processing?.crop) {
        const { width, height } = rotatedSize(bitmap, nextRotation);
        const c = processing.crop;
        setCrop({ unit: "%", x: (c.x / width) * 100, y: (c.y / height) * 100, width: (c.width / width) * 100, height: (c.height / height) * 100 });
      } else {
        setCrop(FULL_CROP);
      }
      setStep("crop");
    } catch {
      setError("Não foi possível ler esta imagem. Tente outra foto.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function editCurrent() {
    if (!originalUrl) return;
    setBusy("reading");
    try {
      const response = await fetch(originalUrl);
      const blob = await response.blob();
      await start(new File([blob], "original", { type: blob.type }), savedProcessing);
    } catch {
      setBusy(null);
      setError("Não foi possível abrir a imagem original.");
    }
  }

  async function save() {
    if (!source || !result) return;
    setBusy("saving");
    setError(null);
    try {
      const original = await prepareOriginal(source.file, source.bitmap, "signature");
      const paths = await uploadAssetFiles({ userId, kind: "signature", original, processed: result.blob });
      const saved = await registerAsset({
        kind: "signature",
        ...paths,
        processing: { crop: pixelCrop(), rotation, removeBackground: removeBg, sensitivity, darken },
      });
      if (!saved.ok) throw new Error(saved.error);
      setStep("view");
      setSource(null);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      // Acionado pelos botões visíveis; o rótulo serve a leitores de tela.
      aria-label="Escolher foto da assinatura ou carimbo"
      tabIndex={-1}
      accept="image/png,image/jpeg,image/webp"
      className="sr-only"
      onChange={(e) => e.target.files?.[0] && start(e.target.files[0], null)}
    />
  );

  if (step === "view") {
    return (
      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Checkerboard className="h-40 p-4">
          {currentUrl ? (
            <img src={currentUrl} alt="Assinatura atual" className="max-h-full max-w-full object-contain" />
          ) : (
            <p className="px-4 text-center text-sm text-slate-500">Nenhuma assinatura enviada</p>
          )}
        </Checkerboard>
        {fileInput}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant={currentUrl ? "secondary" : "primary"}
            pending={busy === "reading"}
            onClick={() => inputRef.current?.click()}
          >
            {currentUrl ? "Enviar nova foto" : "Enviar foto da assinatura"}
          </Button>
          {currentUrl && originalUrl && (
            <Button variant="ghost" disabled={busy !== null} onClick={editCurrent}>
              Ajustar assinatura atual
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Dica: assine e carimbe em papel branco e fotografe de cima, com boa luz e sem sombra da mão.
        </p>
      </div>
    );
  }

  if (step === "crop") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-medium text-slate-900">1. Recorte</p>
          <p className="text-sm text-slate-600">Arraste as bordas para deixar só a assinatura e o carimbo.</p>
        </div>
        <div className="flex justify-center rounded-xl bg-slate-900/5 p-2">
          {cropPreview ? (
            <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} keepSelection ruleOfThirds>
              <img src={cropPreview} alt="Foto para recortar" className="max-h-[55vh] w-auto" />
            </ReactCrop>
          ) : (
            <div className="flex h-48 items-center justify-center">
              <Spinner className="size-6 text-slate-500" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setRotation((r) => (r + 270) % 360); setCrop(FULL_CROP); }} aria-label="Girar para a esquerda">
            ↺ Girar
          </Button>
          <Button variant="secondary" onClick={() => { setRotation((r) => (r + 90) % 360); setCrop(FULL_CROP); }} aria-label="Girar para a direita">
            ↻ Girar
          </Button>
          <Button variant="ghost" onClick={() => setCrop(FULL_CROP)}>
            Imagem inteira
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => setStep("adjust")}>Continuar</Button>
          <Button variant="ghost" onClick={() => { setStep("view"); setSource(null); }}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div>
        <p className="font-medium text-slate-900">2. Ajuste</p>
        <p className="text-sm text-slate-600">O quadriculado mostra onde o fundo ficou transparente.</p>
      </div>

      <Checkerboard className="relative min-h-40 p-4">
        {result && <img src={result.url} alt="Prévia da assinatura" className="max-h-64 max-w-full object-contain" />}
        {busy === "processing" && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-xs">
            <Spinner className="size-3" /> Processando
          </span>
        )}
      </Checkerboard>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-900">
        <input type="checkbox" className="size-5 accent-brand-600" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
        Remover fundo
      </label>

      {removeBg && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sensitivity" className="text-sm font-medium text-slate-800">
              Intensidade
            </label>
            <input
              id="sensitivity"
              type="range"
              min={0}
              max={100}
              value={Math.round(sensitivity * 100)}
              onChange={(e) => setSensitivity(Number(e.target.value) / 100)}
              className="h-11 w-full accent-brand-600"
              aria-describedby="sensitivity-hint"
            />
            <p id="sensitivity-hint" className="text-xs text-slate-500">
              Aumente se partes da assinatura sumirem; diminua se sobrar sujeira do papel.
            </p>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-900">
            <input type="checkbox" className="size-5 accent-brand-600" checked={darken} onChange={(e) => setDarken(e.target.checked)} />
            Escurecer tinta
          </label>
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={save} pending={busy === "saving"} disabled={!result || busy === "processing"}>
          {busy === "saving" ? "Salvando…" : "Salvar assinatura"}
        </Button>
        <Button variant="ghost" disabled={busy === "saving"} onClick={() => setStep("crop")}>
          Voltar ao recorte
        </Button>
      </div>
      <p className="text-xs text-slate-500">A foto original fica guardada: você pode reajustar quando quiser.</p>
    </div>
  );
}
