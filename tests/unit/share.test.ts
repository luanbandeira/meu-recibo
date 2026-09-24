import { afterEach, describe, expect, it, vi } from "vitest";
import { canShareFile, shareFile } from "@/features/sharing/share-pdf";

const pdf = () => new File([new Uint8Array([37, 80, 68, 70])], "recibo-fulano-24-09-2026.pdf", { type: "application/pdf" });

afterEach(() => vi.unstubAllGlobals());

describe("compartilhamento nativo", () => {
  it("sem Web Share (ex.: navegador antigo), não oferece compartilhar", async () => {
    vi.stubGlobal("navigator", {});
    expect(canShareFile(pdf())).toBe(false);
    expect(await shareFile(pdf(), "Recibo")).toBe("unsupported");
  });

  it("navegador que compartilha texto mas não arquivo → não suportado", () => {
    vi.stubGlobal("navigator", { share: vi.fn(), canShare: () => false });
    expect(canShareFile(pdf())).toBe(false);
  });

  it("envia o PDF com título e SEM texto (WhatsApp descarta o arquivo se houver texto)", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    const file = pdf();
    expect(await shareFile(file, "Recibo REC-2026-000001")).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], title: "Recibo REC-2026-000001" });
    expect(share.mock.calls[0][0]).not.toHaveProperty("text");
  });

  it("fechar o menu de compartilhar não é erro", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError")),
      canShare: () => true,
    });
    expect(await shareFile(pdf(), "Recibo")).toBe("cancelled");
  });

  it("falha real (ex.: permissão negada) cai no fallback", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new DOMException("negado", "NotAllowedError")),
      canShare: () => true,
    });
    expect(await shareFile(pdf(), "Recibo")).toBe("failed");
  });

  it("canShare que lança exceção não quebra a página", () => {
    vi.stubGlobal("navigator", { share: vi.fn(), canShare: () => { throw new TypeError("x"); } });
    expect(canShareFile(pdf())).toBe(false);
  });
});
