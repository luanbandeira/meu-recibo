import { describe, expect, it } from "vitest";
import {
  documentTypeOf,
  formatCnpj,
  formatCpf,
  formatCpfCnpj,
  formatPhone,
  isValidCnpj,
  isValidCpf,
  isValidPhone,
  onlyDigits,
} from "@/lib/format/br";

// Documentos fictícios gerados com dígitos verificadores válidos (não são de pessoas reais).
const CPF_VALIDO = "52998224725";
const CNPJ_VALIDO = "11444777000161";

describe("CPF/CNPJ", () => {
  it("formata progressivamente enquanto digita", () => {
    expect(formatCpf("529")).toBe("529");
    expect(formatCpf("5299")).toBe("529.9");
    expect(formatCpf("5299822")).toBe("529.982.2");
    expect(formatCpf(CPF_VALIDO)).toBe("529.982.247-25");
    expect(formatCnpj(CNPJ_VALIDO)).toBe("11.444.777/0001-61");
  });

  it("escolhe a máscara pelo tamanho", () => {
    expect(formatCpfCnpj(CPF_VALIDO)).toBe("529.982.247-25");
    expect(formatCpfCnpj(CNPJ_VALIDO)).toBe("11.444.777/0001-61");
    expect(documentTypeOf("529.982.247-25")).toBe("cpf");
    expect(documentTypeOf("11.444.777/0001-61")).toBe("cnpj");
    expect(documentTypeOf("123")).toBeNull();
  });

  it("valida dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj(CNPJ_VALIDO)).toBe(true);
    expect(isValidCnpj("11444777000162")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

describe("telefone", () => {
  it("formata fixo e celular", () => {
    expect(formatPhone("81")).toBe("(81");
    expect(formatPhone("8132")).toBe("(81) 32");
    expect(formatPhone("8132221234")).toBe("(81) 3222-1234");
    expect(formatPhone("81998765432")).toBe("(81) 99876-5432");
  });

  it("valida DDD e formato", () => {
    expect(isValidPhone("(81) 99876-5432")).toBe(true);
    expect(isValidPhone("8132221234")).toBe(true);
    expect(isValidPhone("81898765432")).toBe(false);
    expect(isValidPhone("0198765432")).toBe(false);
    expect(isValidPhone("9876")).toBe(false);
  });

  it("onlyDigits remove tudo que não é número", () => {
    expect(onlyDigits("(81) 9 9876-5432")).toBe("81998765432");
  });
});
