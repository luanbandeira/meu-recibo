// Valores monetários sempre em centavos (inteiro) — nunca ponto flutuante.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  // Intl usa espaço não separável entre "R$" e o número; normalizamos.
  return brl.format(cents / 100).replace(/ /g, " ");
}

/** Máscara de digitação: os dígitos preenchem da direita ("12345" → R$ 123,45). */
export function maskBRLInput(raw: string): { cents: number | null; display: string } {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 13);
  if (!digits) return { cents: null, display: "" };
  const cents = Number(digits);
  return { cents, display: formatBRL(cents) };
}
