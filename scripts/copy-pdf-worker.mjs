// Copia o worker do pdf.js para /public (servido pelo próprio app, sem CDN).
// Roda no postinstall — local e na Vercel.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/pdfjs", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdfjs/pdf.worker.min.mjs");
