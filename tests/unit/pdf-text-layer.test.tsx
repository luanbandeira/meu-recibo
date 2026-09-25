import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, it } from "vitest";
import { renderReceiptPdf } from "@/features/pdf/render";
import { DEFAULT_SETTINGS } from "@/features/templates/document/constants";

// Regressão: em negrito, uma letra acentuada ("é" de "José") vista ANTES da
// letra base ("e") deixava o "e" sem texto no PDF (copiar/colar e busca
// perdiam o "e"; na tela aparecia). Arquivo próprio = cache de fontes novo,
// como num servidor que acabou de subir.

const profile = {
  full_name: "Pessoa Fictícia", company_name: null, profession: null, council: null, registration_number: null,
  document_type: null, document_number: null, phone: null, city: null, state: null,
};
const boldDoc = (...texts: string[]) => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text, marks: [{ type: "bold" }] }] })),
});
const render = (content: object) =>
  renderReceiptPdf({ content, settings: DEFAULT_SETTINGS, profile, images: { logo: null, signature: null }, fields: [], values: {}, receiptNumber: null, title: "t" });

async function text(buffer: Buffer) {
  const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: false }).promise;
  const content = await (await pdf.getPage(1)).getTextContent();
  return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
}

it("texto em negrito continua copiável depois de letras acentuadas (mesmo servidor, vários PDFs)", async () => {
  await render(boldDoc("José Ângelo Conceição Fictício"));
  const second = await text(await render(boldDoc("Paciente Exemplo de Teste", "Clínica Exemplo Ltda")));
  expect(second).toContain("Paciente Exemplo de Teste");
  expect(second).toContain("Clínica Exemplo Ltda");
}, 60_000);
