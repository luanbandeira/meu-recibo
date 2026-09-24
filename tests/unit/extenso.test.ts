import { describe, expect, it } from "vitest";
import { centsToWords, integerToWords } from "@/lib/format/extenso";

describe("número por extenso", () => {
  it.each([
    [1, "um"],
    [10, "dez"],
    [15, "quinze"],
    [21, "vinte e um"],
    [100, "cem"],
    [101, "cento e um"],
    [110, "cento e dez"],
    [200, "duzentos"],
    [234, "duzentos e trinta e quatro"],
    [999, "novecentos e noventa e nove"],
    [1000, "mil"],
    [1001, "mil e um"],
    [1100, "mil e cem"],
    [1200, "mil e duzentos"],
    [1234, "mil duzentos e trinta e quatro"],
    [2005, "dois mil e cinco"],
    [10000, "dez mil"],
    [100000, "cem mil"],
    [101000, "cento e um mil"],
    [1000000, "um milhão"],
    [1000001, "um milhão e um"],
    [1500000, "um milhão e quinhentos mil"],
    [2345678, "dois milhões trezentos e quarenta e cinco mil seiscentos e setenta e oito"],
    [1000000000, "um bilhão"],
  ])("%i → %s", (n, words) => {
    expect(integerToWords(n)).toBe(words);
  });
});

describe("valor em reais por extenso", () => {
  it.each([
    [0, "zero reais"],
    [1, "um centavo"],
    [50, "cinquenta centavos"],
    [100, "um real"],
    [101, "um real e um centavo"],
    [150, "um real e cinquenta centavos"],
    [50000, "quinhentos reais"],
    [123456, "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"],
    [150000, "mil e quinhentos reais"],
    [100000000, "um milhão de reais"],
    [250000000, "dois milhões e quinhentos mil reais"],
    [200000000000, "dois bilhões de reais"],
  ])("%i centavos → %s", (cents, words) => {
    expect(centsToWords(cents)).toBe(words);
  });

  it("recusa valores inválidos", () => {
    expect(() => centsToWords(-1)).toThrow();
    expect(() => centsToWords(1.5)).toThrow();
  });
});
