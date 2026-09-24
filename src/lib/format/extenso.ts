// Valor por extenso em português do Brasil, a partir de centavos (inteiro).
// Ex.: 123456 → "mil duzentos e trinta e quatro reais e cinquenta e seis centavos".

const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const TEENS = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 1–999 por extenso ("cem", "cento e um", "duzentos e trinta e quatro"). */
function belowThousand(n: number): string {
  if (n === 100) return "cem";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t) parts.push(TENS[t]);
    if (u) parts.push(UNITS[u]);
  }
  return parts.join(" e ");
}

const SCALES: [singular: string, plural: string][] = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
];

/** Inteiro por extenso (0 a 999.999.999.999). */
export function integerToWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= 1e12) throw new RangeError("Valor fora do intervalo.");
  if (value === 0) return "zero";

  const groups: number[] = [];
  for (let n = value; n > 0; n = Math.floor(n / 1000)) groups.push(n % 1000);

  const words: { text: string; group: number }[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    const [singular, plural] = SCALES[i];
    let text: string;
    if (i === 1) text = g === 1 ? "mil" : `${belowThousand(g)} mil`;
    else if (i > 1) text = `${belowThousand(g)} ${g === 1 ? singular : plural}`;
    else text = belowThousand(g);
    words.push({ text, group: g });
  }

  // "e" antes do último grupo quando ele é < 100 ou centena redonda:
  // "mil e cem", "mil e duzentos", "dois mil e cinco"; mas "mil duzentos e trinta".
  return words
    .map((w, index) => {
      if (index === 0) return w.text;
      const isLast = index === words.length - 1;
      const joinWithE = isLast && (w.group < 100 || w.group % 100 === 0);
      return `${joinWithE ? "e " : ""}${w.text}`;
    })
    .join(" ");
}

/** Centavos → "quinhentos reais", "um real e cinquenta centavos", "um milhão de reais". */
export function centsToWords(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError("Valor inválido.");
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;

  const parts: string[] = [];
  if (reais > 0) {
    const words = integerToWords(reais);
    // "um milhão DE reais", "dois bilhões DE reais" (milhão/bilhão exatos).
    const needsDe = reais >= 1_000_000 && reais % 1_000_000 === 0;
    parts.push(`${words}${needsDe ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    parts.push(`${integerToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  return parts.length ? parts.join(" e ") : "zero reais";
}
