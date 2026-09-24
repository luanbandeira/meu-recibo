// Converte as fontes do PDF de WOFF (pacotes @fontsource) para TTF.
//
// Por quê: o gerador de PDF cria um subconjunto da fonte para embutir no
// arquivo; a partir de WOFF, alguns glifos em negrito saíam corrompidos
// (letras sumindo). WOFF 1.0 é só um TTF com tabelas comprimidas (zlib),
// então a conversão é exata: descomprime cada tabela e remonta o TTF.
// Roda no postinstall — local e na Vercel.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const FAMILIES = ["inter", "arimo", "tinos", "lora"];
const VARIANTS = ["400-normal", "700-normal", "400-italic", "700-italic"];
const OUT_DIR = "assets/pdf-fonts";

function woffToTtf(woff) {
  if (woff.toString("ascii", 0, 4) !== "wOFF") throw new Error("Arquivo não é WOFF 1.0");
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);

  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const entry = 44 + i * 20;
    const tag = woff.toString("ascii", entry, entry + 4);
    const offset = woff.readUInt32BE(entry + 4);
    const compLength = woff.readUInt32BE(entry + 8);
    const origLength = woff.readUInt32BE(entry + 12);
    const checksum = woff.readUInt32BE(entry + 16);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? inflateSync(raw) : Buffer.from(raw);
    if (data.length !== origLength) throw new Error(`Tabela ${tag} com tamanho inesperado`);
    tables.push({ tag, checksum, data });
  }
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));

  // Cabeçalho sfnt (offset table)
  const header = Buffer.alloc(12);
  const maxPow2 = 2 ** Math.floor(Math.log2(numTables));
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(maxPow2 * 16, 6);
  header.writeUInt16BE(Math.log2(maxPow2), 8);
  header.writeUInt16BE(numTables * 16 - maxPow2 * 16, 10);

  const directory = Buffer.alloc(numTables * 16);
  const chunks = [];
  let offset = 12 + numTables * 16;
  tables.forEach((table, i) => {
    directory.write(table.tag, i * 16, 4, "ascii");
    directory.writeUInt32BE(table.checksum, i * 16 + 4);
    directory.writeUInt32BE(offset, i * 16 + 8);
    directory.writeUInt32BE(table.data.length, i * 16 + 12);
    const padded = Buffer.alloc(Math.ceil(table.data.length / 4) * 4);
    table.data.copy(padded);
    chunks.push(padded);
    offset += padded.length;
  });
  return Buffer.concat([header, directory, ...chunks]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const family of FAMILIES) {
  for (const variant of VARIANTS) {
    const name = `${family}-latin-${variant}`;
    const woff = readFileSync(`node_modules/@fontsource/${family}/files/${name}.woff`);
    writeFileSync(`${OUT_DIR}/${name}.ttf`, woffToTtf(woff));
  }
}
