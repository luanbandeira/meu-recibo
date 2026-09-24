import { describe, expect, it } from "vitest";
import { professionalProfileSchema, toProfileRow } from "@/features/profile/schema";

const valid = {
  fullName: "Profissional Fictícia",
  companyName: "",
  profession: "Fisioterapeuta",
  council: "crefito-1",
  registrationNumber: "123456-F",
  document: "529.982.247-25",
  phone: "(81) 99876-5432",
  city: "Recife",
  state: "PE",
};

const errorsOf = (input: Record<string, string>) => {
  const result = professionalProfileSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("perfil profissional", () => {
  it("aceita dados válidos e normaliza para o banco", () => {
    const parsed = professionalProfileSchema.parse(valid);
    expect(toProfileRow(parsed)).toEqual({
      full_name: "Profissional Fictícia",
      company_name: null,
      profession: "Fisioterapeuta",
      council: "CREFITO-1",
      registration_number: "123456-F",
      document_type: "cpf",
      document_number: "52998224725",
      phone: "81998765432",
      city: "Recife",
      state: "PE",
    });
  });

  it("aceita CNPJ e identifica o tipo", () => {
    const parsed = professionalProfileSchema.parse({ ...valid, document: "11.444.777/0001-61" });
    expect(toProfileRow(parsed).document_type).toBe("cnpj");
  });

  it("registro é opcional, mas conselho e número andam juntos", () => {
    expect(errorsOf({ ...valid, council: "", registrationNumber: "" })).toEqual([]);
    expect(errorsOf({ ...valid, council: "" })).toEqual(["council"]);
    expect(errorsOf({ ...valid, registrationNumber: "" })).toEqual(["registrationNumber"]);
  });

  it("mostra o erro do registro junto com erros de outros campos", () => {
    expect(errorsOf({ ...valid, registrationNumber: "", phone: "1" }).sort()).toEqual(["phone", "registrationNumber"]);
  });

  it("rejeita documento, telefone e UF inválidos", () => {
    expect(errorsOf({ ...valid, document: "529.982.247-24" })).toEqual(["document"]);
    expect(errorsOf({ ...valid, document: "123" })).toEqual(["document"]);
    expect(errorsOf({ ...valid, phone: "9876-5432" })).toEqual(["phone"]);
    expect(errorsOf({ ...valid, state: "XX" })).toEqual(["state"]);
    expect(errorsOf({ ...valid, fullName: " " })).toEqual(["fullName"]);
  });
});
