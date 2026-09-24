// Identifica o tipo REAL da imagem pelos bytes iniciais (magic bytes) e lê as
// dimensões do cabeçalho — sem confiar em extensão ou Content-Type enviados.

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

export type ImageInfo = { mime: ImageMime; width: number; height: number };

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" && bytes[4] === 0x0d) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  return null;
}

function pngSize(b: Uint8Array) {
  if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(b: Uint8Array) {
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) return null;
    const marker = b[offset + 1];
    // Marcadores sem tamanho (preenchimento / RST).
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    const length = (b[offset + 2] << 8) | b[offset + 3];
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      return { height: (b[offset + 5] << 8) | b[offset + 6], width: (b[offset + 7] << 8) | b[offset + 8] };
    }
    offset += 2 + length;
  }
  return null;
}

function webpSize(b: Uint8Array) {
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 " && b.length >= 30) {
    return { width: ((b[27] << 8) | b[26]) & 0x3fff, height: ((b[29] << 8) | b[28]) & 0x3fff };
  }
  if (chunk === "VP8L" && b.length >= 25) {
    const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (chunk === "VP8X" && b.length >= 30) {
    return {
      width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
      height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
    };
  }
  return null;
}

export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  const mime = detectImageMime(bytes);
  if (!mime) return null;
  const size = mime === "image/png" ? pngSize(bytes) : mime === "image/jpeg" ? jpegSize(bytes) : webpSize(bytes);
  if (!size || size.width < 1 || size.height < 1) return null;
  return { mime, ...size };
}
