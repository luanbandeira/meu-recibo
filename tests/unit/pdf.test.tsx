import { deflateSync } from "node:zlib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { receiptFileName, renderReceiptPdf } from "@/features/pdf/render";
import { DEFAULT_SETTINGS } from "@/features/templates/document/constants";
import { SURGICAL_TEMPLATE_CONTENT } from "@/features/templates/document/default-template";
import type { FieldDefinition, FieldType } from "@/features/templates/document/variables";

// PNG mínimo válido (RGBA sólido) gerado aqui, para testar imagens no PDF.
function crc32(buf: Buffer) {
  let c: number;
  let crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(width: number, height: number) {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 4, 0x80)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let order = 0;
const field = (key: string, type: FieldType): FieldDefinition => ({
  id: key, key, label: key, type, required: false, default_value: null, is_system: true, sort_order: order++, archived_at: null,
});
const fields = [
  field("valor", "currency"), field("pagador", "short_text"), field("cpf_pagador", "document"), field("paciente", "short_text"),
  field("cpf_paciente", "document"), field("cirurgia", "short_text"), field("hospital", "short_text"),
  field("data_procedimento", "date"), field("cidade", "short_text"), field("data_emissao", "date"),
];
const values = {
  valor: 150000, pagador: "José da Silva Fictício", cpf_pagador: "52998224725", paciente: "Maria Paciente Fictícia",
  cpf_paciente: "11144477735", cirurgia: "Artroplastia de joelho", hospital: "Hospital Fictício São João",
  data_procedimento: "2026-09-20", cidade: "Recife", data_emissao: "2026-09-24",
};
const profile = {
  full_name: "Ana Souza Fictícia", company_name: null, profession: "Fisioterapeuta", council: "CREFITO-1",
  registration_number: "123456-F", document_type: "cpf" as const, document_number: "52998224725", phone: "81998765432",
  city: "Recife", state: "PE",
};
const images = {
  logo: { data: png(120, 120), format: "png" as const, width: 120, height: 120 },
  signature: { data: png(300, 90), format: "png" as const, width: 300, height: 90 },
};

async function extract(buffer: Buffer) {
  const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " "));
  }
  return { numPages: pdf.numPages, pages, text: pages.join(" ") };
}

describe("PDF do recibo", () => {
  it("gera A4 com texto real (não imagem), valores formatados e sem variáveis cruas", async () => {
    const buffer = await renderReceiptPdf({
      content: SURGICAL_TEMPLATE_CONTENT, settings: DEFAULT_SETTINGS, profile, images, fields, values,
      receiptNumber: "REC-2026-000001", title: "Recibo REC-2026-000001",
    });
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

    const { numPages, text } = await extract(buffer);
    expect(numPages).toBe(1);
    for (const expected of [
      "Ana Souza Fictícia",
      "Fisioterapeuta - CREFITO-1 123456-F",
      "CPF: 529.982.247-25 - Celular: (81) 99876-5432",
      "RECIBO DE HONORÁRIOS",
      "José da Silva Fictício",
      "R$ 1.500,00",
      "mil e quinhentos reais",
      "Maria Paciente Fictícia",
      "111.444.777-35",
      "20/09/2026",
      "Recife, 24 de setembro de 2026",
    ]) {
      expect(text).toContain(expected);
    }
    expect(text).not.toContain("{{");
  }, 30_000);

  it("A4 exato: 595,28 × 841,89 pt", async () => {
    const buffer = await renderReceiptPdf({
      content: SURGICAL_TEMPLATE_CONTENT, settings: DEFAULT_SETTINGS, profile, images: { logo: null, signature: null },
      fields, values, receiptNumber: null, title: "t",
    });
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const [, , w, h] = (await pdf.getPage(1)).view;
    expect(Math.round(w)).toBe(595);
    expect(Math.round(h)).toBe(842);
  }, 30_000);

  it("texto longo quebra de página e a assinatura não é partida", async () => {
    const long = "Texto de teste bem comprido para ocupar várias linhas do documento. ".repeat(40);
    const content = {
      type: "doc",
      content: [
        { type: "professionalHeader", attrs: { layout: "logo-left" } },
        ...Array.from({ length: 5 }, () => ({ type: "paragraph", attrs: { textAlign: "justify" }, content: [{ type: "text", text: long }] })),
        { type: "signature", attrs: { align: "center", size: "medium", showName: true } },
      ],
    };
    const buffer = await renderReceiptPdf({ content, settings: DEFAULT_SETTINGS, profile, images, fields, values, receiptNumber: null, title: "t" });
    const { numPages, pages } = await extract(buffer);
    expect(numPages).toBeGreaterThan(1);
    // Nome sob a assinatura aparece inteiro na última página.
    expect(pages[numPages - 1]).toContain("Ana Souza Fictícia Fisioterapeuta - CREFITO-1 123456-F");
  }, 30_000);
});

describe("nome do arquivo", () => {
  it.each([
    [{ payer: "Maria da Silva", date: "2026-09-23", number: "REC-2026-000001" }, "recibo-maria-da-silva-23-09-2026.pdf"],
    [{ payer: "José Ção & Cia. / Ltda", date: "2026-01-05", number: "REC-2026-000002" }, "recibo-jose-cao-cia-ltda-05-01-2026.pdf"],
    [{ payer: null, date: null, number: "REC-2026-000003" }, "recibo-rec-2026-000003.pdf"],
    [{ payer: "../../etc/passwd", date: "2026-01-05", number: "x" }, "recibo-etc-passwd-05-01-2026.pdf"],
    [{ payer: "Maria da Silva", date: "2026-09-23", number: "x", version: 1 }, "recibo-maria-da-silva-23-09-2026.pdf"],
    [{ payer: "Maria da Silva", date: "2026-09-23", number: "x", version: 2 }, "recibo-maria-da-silva-23-09-2026-v2.pdf"],
  ])("%j → %s", (input, expected) => {
    const name = receiptFileName(input);
    expect(name).toBe(expected);
    expect(name).toMatch(/^[a-z0-9-]{1,80}\.pdf$/);
  });

  it("limita o tamanho, mantendo o sufixo de versão", () => {
    const name = receiptFileName({ payer: "Nome ".repeat(50), date: "2026-01-01", number: "x" });
    expect(name.length).toBeLessThanOrEqual(84);
    expect(name).toMatch(/^[a-z0-9-]+\.pdf$/);
    const long = "Nome Muito Comprido ".repeat(10);
    const v12 = receiptFileName({ payer: long, date: "2026-01-01", number: "x", version: 12 });
    expect(v12).toMatch(/^[a-z0-9-]{1,80}-v12\.pdf$/);
  });
});
