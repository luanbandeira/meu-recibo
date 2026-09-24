import { describe, expect, it } from "vitest";
import { removeBackground, trimTransparent, type RgbaImage } from "@/features/assets/background-removal";
import { detectImageMime, readImageInfo } from "@/features/assets/image-validation";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u24le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];

const png = (w: number, h: number) =>
  bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], u32be(13), "IHDR", u32be(w), u32be(h), [8, 6, 0, 0, 0]);

const jpeg = (w: number, h: number) =>
  bytes(
    [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], "JFIF", [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    [0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
  );

const webpVp8x = (w: number, h: number) =>
  bytes("RIFF", [0, 0, 0, 0], "WEBP", "VP8X", [10, 0, 0, 0], [0x10, 0, 0, 0], u24le(w - 1), u24le(h - 1));

describe("validação de imagem por magic bytes", () => {
  it("identifica tipo e dimensões de PNG, JPEG e WEBP", () => {
    expect(readImageInfo(png(300, 120))).toEqual({ mime: "image/png", width: 300, height: 120 });
    expect(readImageInfo(jpeg(1024, 768))).toEqual({ mime: "image/jpeg", width: 1024, height: 768 });
    expect(readImageInfo(webpVp8x(640, 480))).toEqual({ mime: "image/webp", width: 640, height: 480 });
  });

  it("rejeita arquivos que não são imagem, mesmo com extensão de imagem", () => {
    expect(detectImageMime(bytes("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(detectImageMime(bytes("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageMime(bytes("GIF89a", [1, 0, 1, 0]))).toBeNull();
    expect(detectImageMime(bytes("%PDF-1.7"))).toBeNull();
    expect(readImageInfo(new Uint8Array())).toBeNull();
  });

  it("rejeita cabeçalho truncado ou corrompido", () => {
    expect(readImageInfo(png(300, 120).slice(0, 20))).toBeNull();
    expect(readImageInfo(png(0, 120))).toBeNull();
  });
});

/** "Foto" sintética: papel com sombra forte à direita, traço azul e carimbo preenchido. */
function syntheticPhoto(): RgbaImage {
  const width = 240;
  const height = 120;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const light = 1 - 0.45 * (x / width); // 100% → 55% de iluminação
      const isStroke = y >= 58 && y <= 62 && x >= 10 && x <= 230;
      const isStamp = x >= 150 && x < 200 && y >= 10 && y < 50;
      const [r, g, b] = isStroke ? [35, 55, 170] : isStamp ? [150, 30, 40] : [245, 242, 235];
      const i = (y * width + x) * 4;
      data[i] = r * light;
      data[i + 1] = g * light;
      data[i + 2] = b * light;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const pixel = (img: RgbaImage, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] };
};

describe("remoção de fundo", () => {
  const result = removeBackground(syntheticPhoto());

  it("deixa o papel transparente, inclusive na parte com sombra", () => {
    expect(pixel(result, 5, 100).a).toBeLessThan(10);
    expect(pixel(result, 230, 100).a).toBeLessThan(10);
  });

  it("não deixa véu em nenhum ponto do papel, nem nas bordas com sombra", () => {
    for (const sensitivity of [0, 0.5, 1]) {
      const out = removeBackground(syntheticPhoto(), { sensitivity });
      let worst = 0;
      for (let y = 0; y < out.height; y++) {
        for (let x = 0; x < out.width; x++) {
          const ink = (y >= 58 && y <= 62 && x >= 10 && x <= 230) || (x >= 150 && x < 200 && y >= 10 && y < 50);
          if (!ink) worst = Math.max(worst, pixel(out, x, y).a);
        }
      }
      expect(worst).toBeLessThanOrEqual(16);
    }
  });

  it("mantém o traço opaco e com a cor da caneta (azul)", () => {
    for (const x of [20, 120, 225]) {
      const p = pixel(result, x, 60);
      expect(p.a).toBeGreaterThan(240);
      expect(p.b).toBeGreaterThan(p.r + 60);
    }
  });

  it("mantém o miolo de um carimbo preenchido (não confunde com papel)", () => {
    const p = pixel(result, 175, 30);
    expect(p.a).toBeGreaterThan(240);
    expect(p.r).toBeGreaterThan(p.b);
  });

  it("sensibilidade maior preserva traços mais claros", () => {
    const faint = syntheticPhoto();
    for (let x = 10; x < 230; x++) {
      const i = (100 * faint.width + x) * 4;
      const light = 1 - 0.45 * (x / faint.width);
      faint.data[i] = 200 * light;
      faint.data[i + 1] = 200 * light;
      faint.data[i + 2] = 215 * light;
    }
    const low = removeBackground(faint, { sensitivity: 0 });
    const high = removeBackground(faint, { sensitivity: 1 });
    expect(pixel(high, 120, 100).a).toBeGreaterThan(pixel(low, 120, 100).a);
  });

  it("recorta as margens transparentes", () => {
    const trimmed = trimTransparent(result, 4);
    expect(trimmed.width).toBeLessThan(result.width);
    expect(trimmed.height).toBeLessThan(result.height);
    expect(trimmed.height).toBeGreaterThanOrEqual(62 - 10 + 1);
  });
});
