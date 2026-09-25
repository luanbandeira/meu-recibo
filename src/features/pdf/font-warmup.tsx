import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { FONT_KEYS } from "@/features/templates/document/constants";

// Correção do texto "escondido" do PDF (copiar/colar, busca, leitor de tela).
//
// O fontkit guarda cada glifo em cache com o caractere de quando foi criado.
// Ao desenhar uma letra acentuada ("é"), ele carrega a letra base ("e") como
// componente SEM caractere; se essa for a primeira vez que o "e" aparece
// naquela fonte, o cache fica com o "e" sem texto e todo PDF seguinte do
// mesmo servidor perde o "e" nesse texto (na tela ele aparece normalmente).
//
// Solução: uma vez por processo, antes do primeiro recibo, diagramar todos os
// caracteres em cada fonte/peso/estilo, com as letras SEM acento primeiro.
// Assim o cache já nasce com o caractere certo de cada glifo.

const BASE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?()[]{}/\\|-_+=*&%$#@'\"<>~^`";
const EXTRA = "–—‘’“”•…ºª°§€£";
const ACCENTED = "áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ";
export const WARMUP_TEXT = `${BASE}${EXTRA}${ACCENTED}`;

let warmup: Promise<void> | null = null;

/** Roda uma única vez por processo (as chamadas seguintes esperam a mesma). */
export function warmPdfFonts(): Promise<void> {
  warmup ??= renderToBuffer(
    <Document>
      <Page size="A4">
        {FONT_KEYS.flatMap((family) =>
          ([400, 700] as const).flatMap((fontWeight) =>
            (["normal", "italic"] as const).map((fontStyle) => (
              <Text key={`${family}-${fontWeight}-${fontStyle}`} style={{ fontFamily: family, fontWeight, fontStyle, fontSize: 8 }}>
                {WARMUP_TEXT}
              </Text>
            )),
          ),
        )}
      </Page>
    </Document>,
  ).then(
    () => undefined,
    (error) => {
      warmup = null; // tenta de novo no próximo recibo
      throw error;
    },
  );
  return warmup;
}
