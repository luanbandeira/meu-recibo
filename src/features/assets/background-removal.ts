/**
 * Remoção de fundo para assinatura + carimbo (tinta sobre papel).
 *
 * Não é segmentação por IA: é limiarização adaptativa, que funciona melhor
 * para este caso e roda 100% no aparelho, sem enviar a imagem a ninguém.
 *
 * 1. Estima a cor do papel por região (percentil alto da luminância em blocos)
 *    → corrige sombra e iluminação desigual de fotos de celular.
 * 2. Mede quanto cada pixel é mais escuro que o papel ao redor.
 * 3. Converte em transparência com rampa suave (bordas sem serrilhado).
 * 4. Mantém a cor da tinta (azul da caneta, cor do carimbo), clareando o
 *    "cinza" da sombra; opcionalmente escurece a tinta.
 *
 * Função pura sobre RGBA: testável sem canvas.
 */

export type BackgroundRemovalOptions = {
  /** 0 a 1. Maior = preserva traços mais claros (e mais sujeira). Padrão 0.5. */
  sensitivity?: number;
  /** Escurece a tinta para dar contraste na impressão. */
  darken?: boolean;
};

export type RgbaImage = { data: Uint8ClampedArray; width: number; height: number };

const BLOCK = 24;
/** Bloco abaixo de 80% do vizinho mais claro é tratado como coberto de tinta. */
const INK_BLOCK_RATIO = 0.8;

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Luminância do papel por bloco (percentil 90), com interpolação bilinear. */
function estimatePaper(image: RgbaImage): Float32Array {
  const { data, width, height } = image;
  const cols = Math.ceil(width / BLOCK);
  const rows = Math.ceil(height / BLOCK);
  const grid = new Float32Array(cols * rows);
  const histogram = new Uint32Array(256);

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      histogram.fill(0);
      let count = 0;
      for (let y = by * BLOCK; y < Math.min(height, (by + 1) * BLOCK); y++) {
        for (let x = bx * BLOCK; x < Math.min(width, (bx + 1) * BLOCK); x++) {
          const i = (y * width + x) * 4;
          histogram[Math.round(luminance(data[i], data[i + 1], data[i + 2]))]++;
          count++;
        }
      }
      let target = count * 0.9;
      let value = 255;
      for (let v = 0; v < 256; v++) {
        target -= histogram[v];
        if (target <= 0) {
          value = v;
          break;
        }
      }
      grid[by * cols + bx] = Math.max(value, 1);
    }
  }

  // Bloco quase todo coberto por tinta (ex.: miolo de um carimbo) fica muito
  // mais escuro que os vizinhos: usa o vizinho mais claro para não "apagar" a
  // tinta. Variação suave (sombra) não passa do limite e é preservada.
  const smoothed = grid.slice();
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      let max = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = bx + dx;
          const ny = by + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < cols && ny < rows) max = Math.max(max, grid[ny * cols + nx]);
        }
      }
      if (grid[by * cols + bx] < max * INK_BLOCK_RATIO) smoothed[by * cols + bx] = max;
    }
  }

  // Interpolação bilinear entre centros dos blocos, com extrapolação linear
  // até as bordas (a sombra continua além do último centro).
  const axis = (pos: number, count: number) => {
    const g = (pos + 0.5) / BLOCK - 0.5;
    if (count === 1) return { i0: 0, i1: 0, f: 0 };
    const i0 = Math.min(Math.max(Math.floor(g), 0), count - 2);
    return { i0, i1: i0 + 1, f: g - i0 };
  };

  const paper = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const { i0: y0, i1: y1, f: fy } = axis(y, rows);
    for (let x = 0; x < width; x++) {
      const { i0: x0, i1: x1, f: fx } = axis(x, cols);
      const top = smoothed[y0 * cols + x0] * (1 - fx) + smoothed[y0 * cols + x1] * fx;
      const bottom = smoothed[y1 * cols + x0] * (1 - fx) + smoothed[y1 * cols + x1] * fx;
      paper[y * width + x] = Math.min(Math.max(top * (1 - fy) + bottom * fy, 1), 255);
    }
  }
  return paper;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

export function removeBackground(image: RgbaImage, options: BackgroundRemovalOptions = {}): RgbaImage {
  const sensitivity = Math.min(Math.max(options.sensitivity ?? 0.5, 0), 1);
  const { data, width, height } = image;
  const paper = estimatePaper(image);
  const out = new Uint8ClampedArray(data.length);

  // Quanto mais sensível, menor o contraste mínimo para contar como tinta.
  const low = 0.16 - 0.13 * sensitivity; // 0.16 → 0.03
  const high = low + 0.14;

  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const bg = paper[p];
    const darkness = 1 - Math.min(luminance(r, g, b) / bg, 1);
    const alpha = smoothstep(low, high, darkness) * (data[i + 3] / 255);

    // Normaliza pela cor do papel (remove o cinza da sombra) e mantém o matiz.
    const scale = 255 / bg;
    let nr = Math.min(r * scale, 255);
    let ng = Math.min(g * scale, 255);
    let nb = Math.min(b * scale, 255);
    if (options.darken) {
      nr *= 0.55;
      ng *= 0.55;
      nb *= 0.55;
    }

    out[i] = nr;
    out[i + 1] = ng;
    out[i + 2] = nb;
    out[i + 3] = Math.round(alpha * 255);
  }

  return { data: out, width, height };
}

/** Recorta margens transparentes, deixando um respiro. */
export function trimTransparent(image: RgbaImage, padding = 8, threshold = 16): RgbaImage {
  const { data, width, height } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return image;

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const start = ((minY + y) * width + minX) * 4;
    out.set(data.subarray(start, start + w * 4), y * w * 4);
  }
  return { data: out, width: w, height: h };
}
