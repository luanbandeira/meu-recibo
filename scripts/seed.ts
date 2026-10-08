/**
 * Popula um Supabase LOCAL com dados fictícios de demonstração.
 *
 *   npx supabase start
 *   npm run seed            (executado por scripts/run-ts.mjs)
 *
 * Cria um super admin e uma profissional fictícia já configurada (perfil,
 * logo, assinatura e modelos) e emite recibos pelo mesmo caminho do app:
 * validação dos valores → RPC `issue_receipt` com a sessão da usuária →
 * PDF renderizado a partir dos snapshots → `attach_receipt_pdf`.
 *
 * Só roda contra um Supabase em localhost: nunca em produção.
 */
import { createHash, randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readImageInfo } from "@/features/assets/image-validation";
import { receiptFileName, renderReceiptPdf } from "@/features/pdf/render";
import { buildSummary, emissionFields, validateValues, withSignatureMode, type RawValues } from "@/features/receipts/values";
import { DEFAULT_SETTINGS } from "@/features/templates/document/constants";
import { TEMPLATE_PRESETS, type TemplatePresetKey } from "@/features/templates/document/default-template";
import { extractVariables, type FieldDefinition } from "@/features/templates/document/variables";
import { loadLocalEnv, requireEnv } from "./env";
import { refuseProduction } from "./production";

const SENHA = "demo123456";

loadLocalEnv();
refuseProduction("Seed");
const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) {
  console.error("Seed recusado: só roda contra o Supabase local (npx supabase start).");
  process.exit(1);
}
const domain = requireEnv("NEXT_PUBLIC_AUTH_EMAIL_DOMAIN");
const admin = createClient(url, requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ------------------------------------------------------------------ imagens
// PNGs gerados aqui mesmo, para o seed não depender de arquivos binários.

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

class Canvas {
  readonly pixels: Uint8Array;
  constructor(readonly width: number, readonly height: number) {
    this.pixels = new Uint8Array(width * height * 4);
  }
  plot(x: number, y: number, [r, g, b]: number[], alpha = 255) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    const i = (yi * this.width + xi) * 4;
    this.pixels.set([r, g, b, Math.max(this.pixels[i + 3], alpha)], i);
  }
  /** Círculo cheio com borda suave. */
  disc(cx: number, cy: number, radius: number, color: number[]) {
    for (let y = Math.floor(cy - radius - 1); y <= cy + radius + 1; y++) {
      for (let x = Math.floor(cx - radius - 1); x <= cx + radius + 1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= radius + 0.5) this.plot(x, y, color, Math.round(255 * Math.min(1, radius + 0.5 - d)));
      }
    }
  }
  roundedRect(x0: number, y0: number, w: number, h: number, r: number, color: number[]) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const dx = Math.max(x0 + r - x, 0, x - (x0 + w - 1 - r));
        const dy = Math.max(y0 + r - y, 0, y - (y0 + h - 1 - r));
        if (Math.hypot(dx, dy) <= r) this.plot(x, y, color);
      }
    }
  }
  /** Traço contínuo por uma lista de pontos. */
  stroke(points: [number, number][], radius: number, color: number[]) {
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let s = 0; s <= steps; s++) this.disc(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, radius, color);
    }
  }
  png(): Buffer {
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      raw[y * (this.width * 4 + 1)] = 0;
      Buffer.from(this.pixels.buffer, y * this.width * 4, this.width * 4).copy(raw, y * (this.width * 4 + 1) + 1);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

/** Logo fictícia: folha de recibo estilizada sobre um quadrado arredondado. */
function logoPng() {
  const c = new Canvas(320, 320);
  const verde = [15, 118, 110];
  const branco = [255, 255, 255];
  c.roundedRect(0, 0, 320, 320, 64, verde);
  c.roundedRect(92, 60, 136, 190, 14, branco);
  for (const [y, w] of [[100, 84], [128, 84], [156, 60]] as const) c.stroke([[118, y], [118 + w, y]], 6, verde);
  c.stroke([[124, 205], [146, 226], [196, 182]], 9, verde);
  return c.png();
}

/** Assinatura fictícia: um traço cursivo em tinta azul, fundo transparente. */
function assinaturaPng() {
  const c = new Canvas(640, 220);
  const tinta = [29, 58, 143];
  const pontos: [number, number][] = [];
  for (let t = 0; t <= 1; t += 0.002) {
    const x = 40 + t * 540;
    const y = 120 - 42 * Math.sin(t * 22) * Math.exp(-1.2 * t) - 18 * Math.sin(t * 7) + 30 * t;
    pontos.push([x + 14 * Math.cos(t * 22), y]);
  }
  c.stroke(pontos, 2.6, tinta);
  c.stroke([[70, 178], [560, 168]], 2, tinta);
  return c.png();
}

// ------------------------------------------------------------------ dados

async function criarConta(username: string, nome: string, role: "user" | "super_admin") {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${domain}`,
    password: SENHA,
    email_confirm: true,
    app_metadata: { username, display_name: nome, role },
  });
  if (error || !data.user) throw new Error(`Conta ${username}: ${error?.message}`);
  await admin.from("profiles").update({ must_change_password: false }).eq("id", data.user.id);
  return data.user.id;
}

async function enviarImagem(userId: string, kind: "logo" | "signature", png: Buffer) {
  const bucket = kind === "logo" ? "logos" : "signatures";
  const info = readImageInfo(png);
  if (!info) throw new Error(`Imagem ${kind} inválida`);
  const ids: string[] = [];
  for (const variant of ["original", "processed"] as const) {
    const path = `${userId}/${randomUUID()}.png`;
    const up = await admin.storage.from(bucket).upload(path, png, { contentType: "image/png" });
    if (up.error) throw new Error(`Upload ${kind}: ${up.error.message}`);
    const { data, error } = await admin
      .from("user_assets")
      .insert({
        user_id: userId,
        kind,
        variant,
        source_asset_id: variant === "processed" ? ids[0] : null,
        bucket,
        storage_path: path,
        mime_type: "image/png",
        size_bytes: png.length,
        width: info.width,
        height: info.height,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Imagem ${kind}: ${error?.message}`);
    ids.push(data.id);
  }
  return ids[1];
}

async function criarModelos(userId: string) {
  const escolhidos: TemplatePresetKey[] = ["servico", "saude", "servico_cliente"];
  const ids: Partial<Record<TemplatePresetKey, string>> = {};
  for (const key of escolhidos) {
    const preset = TEMPLATE_PRESETS.find((p) => p.key === key)!;
    const { data, error } = await admin
      .from("receipt_templates")
      .insert({
        user_id: userId,
        name: preset.name,
        content: preset.content,
        settings: DEFAULT_SETTINGS,
        used_variables: extractVariables(preset.content),
        is_default: key === "servico",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Modelo ${key}: ${error?.message}`);
    ids[key] = data.id;
  }
  return ids as Record<"servico" | "saude" | "servico_cliente", string>;
}

type Sessao = { client: SupabaseClient; userId: string };

async function entrar(username: string): Promise<Sessao> {
  const client = createClient(url, requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: `${username}@${domain}`, password: SENHA });
  if (error || !data.user) throw new Error(`Login ${username}: ${error?.message}`);
  return { client, userId: data.user.id };
}

async function carregarImagem(client: SupabaseClient, ref: { bucket: string; path: string } | null) {
  if (!ref) return null;
  const { data } = await client.storage.from(ref.bucket).download(ref.path);
  if (!data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  const info = readImageInfo(buffer)!;
  return { data: buffer, format: "png" as const, width: info.width, height: info.height };
}

/** Mesmo passo de `generateAndAttachPdf`, com a sessão da usuária. */
async function gerarPdf({ client, userId }: Sessao, versionId: string, fields: FieldDefinition[]) {
  const { data: v, error } = await client
    .from("receipt_versions")
    .select(
      `id, receipt_id, version_no, template_snapshot, profile_snapshot, values,
       receipt:receipts!receipt_versions_receipt_id_fkey(number, payer_name, issued_at)`,
    )
    .eq("id", versionId)
    .single();
  if (error || !v) throw new Error(`Versão ${versionId}: ${error?.message}`);
  const receipt = v.receipt as unknown as { number: string; payer_name: string | null; issued_at: string };
  const [logo, signature] = await Promise.all([
    carregarImagem(client, v.profile_snapshot.logo),
    carregarImagem(client, v.profile_snapshot.signature),
  ]);
  const pdf = await renderReceiptPdf({
    content: v.template_snapshot.content,
    settings: v.template_snapshot.settings ?? DEFAULT_SETTINGS,
    profile: v.profile_snapshot,
    images: { logo, signature },
    fields,
    values: v.values,
    receiptNumber: receipt.number,
    title: `Recibo ${receipt.number}`,
  });
  const path = `${userId}/${v.receipt_id}/v${v.version_no}.pdf`;
  const up = await client.storage.from("receipts").upload(path, pdf, { contentType: "application/pdf" });
  if (up.error) throw new Error(`PDF ${receipt.number}: ${up.error.message}`);
  const attach = await client.rpc("attach_receipt_pdf", {
    p_version_id: v.id,
    p_pdf_path: path,
    p_pdf_sha256: createHash("sha256").update(pdf).digest("hex"),
    p_file_name: receiptFileName({
      payer: receipt.payer_name,
      date: typeof v.values.data_emissao === "string" ? v.values.data_emissao : receipt.issued_at.slice(0, 10),
      number: receipt.number,
      version: v.version_no,
    }),
  });
  if (attach.error) throw new Error(`Anexar PDF ${receipt.number}: ${attach.error.message}`);
}

function valoresValidos(templateUsed: string[], fields: FieldDefinition[], raw: RawValues) {
  const formFields = emissionFields(templateUsed, fields);
  const result = validateValues(formFields, raw);
  if (!result.ok) throw new Error(`Valores inválidos: ${JSON.stringify(result.errors)}`);
  return {
    values: withSignatureMode(result.values, raw, templateUsed),
    summary: buildSummary(formFields, result.values),
  };
}

const diasAtras = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("sv-SE");
};

// CPFs e CNPJ de teste conhecidos publicamente (os mesmos dos testes do projeto).
const RECIBOS: { modelo: "servico" | "saude" | "servico_cliente"; dias: number; raw: RawValues }[] = [
  { modelo: "saude", dias: 2, raw: { pagador: "Carlos Eduardo Lima", cpf_pagador: "529.982.247-25", paciente: "Helena Lima", cpf_paciente: "111.444.777-35", valor: "250,00", data_procedimento: "" } },
  { modelo: "servico", dias: 4, raw: { pagador: "Padaria Bom Sabor Ltda", cpf_pagador: "11.444.777/0001-61", valor: "1.200,00", descricao_servico: "consultoria de organização financeira (setembro)" } },
  { modelo: "saude", dias: 7, raw: { pagador: "Fernanda Rocha", cpf_pagador: "111.444.777-35", paciente: "Fernanda Rocha", cpf_paciente: "111.444.777-35", valor: "180,00" } },
  { modelo: "servico_cliente", dias: 10, raw: { pagador: "Ricardo Menezes", cpf_pagador: "529.982.247-25", valor: "640,00", descricao_servico: "avaliação e plano de atendimento domiciliar" } },
  { modelo: "saude", dias: 15, raw: { pagador: "Juliana Prado", cpf_pagador: "529.982.247-25", paciente: "Tomás Prado", cpf_paciente: "111.444.777-35", valor: "250,00" } },
  { modelo: "servico", dias: 21, raw: { pagador: "Marcos Vinícius Souza", cpf_pagador: "111.444.777-35", valor: "350,00", descricao_servico: "pacote de 4 sessões" } },
  { modelo: "saude", dias: 33, raw: { pagador: "Ana Beatriz Freitas", cpf_pagador: "529.982.247-25", paciente: "Ana Beatriz Freitas", cpf_paciente: "529.982.247-25", valor: "180,00" } },
  { modelo: "servico", dias: 40, raw: { pagador: "Clínica Bem Viver Ltda", cpf_pagador: "11.444.777/0001-61", valor: "2.400,00", descricao_servico: "atendimentos realizados em agosto" } },
];

async function main() {
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    console.error("O banco já tem usuários. Para recomeçar: npx supabase db reset");
    process.exit(1);
  }

  await criarConta("admin", "Administrador Demo", "super_admin");
  const userId = await criarConta("demo", "Mariana Alves Costa", "user");

  const perfil = await admin.from("professional_profiles").insert({
    user_id: userId,
    full_name: "Mariana Alves Costa",
    profession: "Fisioterapeuta",
    council: "CREFITO-3",
    registration_number: "000000-F",
    document_type: "cpf",
    document_number: "52998224725",
    phone: "11987654321",
    city: "São Paulo",
    state: "SP",
  });
  if (perfil.error) throw new Error(`Perfil: ${perfil.error.message}`);
  const logo = await enviarImagem(userId, "logo", logoPng());
  const assinatura = await enviarImagem(userId, "signature", assinaturaPng());
  const vinculo = await admin
    .from("professional_profiles")
    .update({ logo_asset_id: logo, signature_asset_id: assinatura, onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (vinculo.error) throw new Error(`Perfil: ${vinculo.error.message}`);

  const modelos = await criarModelos(userId);

  const sessao = await entrar("demo");
  const { data: fields, error: erroCampos } = await sessao.client
    .from("fields")
    .select("id, key, label, type, required, default_value, is_system, sort_order, archived_at")
    .order("sort_order");
  if (erroCampos || !fields) throw new Error(`Campos: ${erroCampos?.message}`);
  const { data: templates } = await sessao.client.from("receipt_templates").select("id, used_variables");
  const usados = new Map((templates ?? []).map((t) => [t.id as string, t.used_variables as string[]]));

  // Do mais antigo para o mais recente, para a numeração seguir a ordem das datas.
  let primeiro: { receiptId: string; modelo: string } | null = null;
  for (const r of [...RECIBOS].sort((a, b) => b.dias - a.dias)) {
    const templateId = modelos[r.modelo];
    const data = diasAtras(r.dias);
    const raw: RawValues = { cidade: "São Paulo", data_emissao: data, data_procedimento: data, ...r.raw };
    if (!raw.data_procedimento) raw.data_procedimento = data;
    const { values, summary } = valoresValidos(usados.get(templateId)!, fields as FieldDefinition[], raw);
    const { data: emitido, error } = await sessao.client.rpc("issue_receipt", {
      p_template_id: templateId,
      p_values: values,
      p_summary: summary,
      p_idempotency_key: randomUUID(),
    });
    if (error || !emitido) throw new Error(`Emissão: ${error?.message}`);
    await gerarPdf(sessao, emitido.version_id, fields as FieldDefinition[]);
    primeiro ??= { receiptId: emitido.receipt_id, modelo: templateId };
    process.stdout.write(".");
  }

  // Uma correção, para o histórico mostrar uma versão 2.
  if (primeiro) {
    const r = [...RECIBOS].sort((a, b) => b.dias - a.dias)[0];
    const data = diasAtras(r.dias);
    const raw: RawValues = { cidade: "São Paulo", data_emissao: data, data_procedimento: data, ...r.raw, valor: "2.600,00" };
    const { values, summary } = valoresValidos(usados.get(primeiro.modelo)!, fields as FieldDefinition[], raw);
    const { data: corrigido, error } = await sessao.client.rpc("correct_receipt", {
      p_receipt_id: primeiro.receiptId,
      p_values: values,
      p_summary: summary,
      p_note: "Valor ajustado: inclui o atendimento do dia 30.",
      p_idempotency_key: randomUUID(),
    });
    if (error || !corrigido) throw new Error(`Correção: ${error?.message}`);
    await gerarPdf(sessao, corrigido.version_id, fields as FieldDefinition[]);
  }

  console.log(`\n${RECIBOS.length} recibos emitidos (um deles corrigido).\n`);
  console.log("Acesse http://localhost:3000 com:");
  console.log(`  demo   senha: ${SENHA}  (profissional)`);
  console.log(`  admin  senha: ${SENHA}  (super admin)`);
}

// Executado por scripts/run-ts.mjs, que espera esta função terminar.
export default async function seed() {
  try {
    await main();
  } catch (e) {
    console.error("\nSeed interrompido:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}
