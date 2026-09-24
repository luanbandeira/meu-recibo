/**
 * Aplica todas as migrations num Postgres embutido (PGlite) e verifica RLS,
 * privilégios e RPCs simulando usuários via auth.uid(). Não precisa de rede,
 * Docker nem projeto Supabase — roda em qualquer máquina e no CI.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";

let db: PGlite;

type Row = Record<string, unknown>;

/** Executa SQL como o usuário `uid` (papel authenticated, como no PostgREST). */
async function as<T extends Row = Row>(uid: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`,
  );
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

const issue = (uid: string, templateId: string, key = crypto.randomUUID()) =>
  as<{ r: { receipt_id: string; version_id: string; number: string; version_no: number } }>(
    uid,
    `select public.issue_receipt($1, '{"valor":100}', '{"payer_name":"X","amount_cents":100}', $2) as r`,
    [templateId, key],
  ).then((rows) => rows[0].r);

let templateA: string;
let templateB: string;
let receiptB: Awaited<ReturnType<typeof issue>>;

beforeAll(async () => {
  db = new PGlite({ extensions: { citext, pg_trgm, unaccent } });
  await db.exec(readFileSync("tests/db/supabase-stubs.sql", "utf8"));
  const dir = "supabase/migrations";
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }

  await db.exec(`
    insert into auth.users (id, raw_app_meta_data) values
      ('${A}', '{"username":"usuario-a","display_name":"A"}'),
      ('${B}', '{"username":"usuario-b","display_name":"B"}'),
      ('${ADMIN}', '{"username":"admin","display_name":"Admin","role":"super_admin"}');
  `);

  for (const uid of [A, B]) {
    await as(uid, `insert into public.professional_profiles (user_id, full_name, city, state)
                   values ($1, 'Profissional', 'Recife', 'PE')`, [uid]);
  }
  const insertTemplate = `insert into public.receipt_templates (user_id, name, content)
                          values ($1, 'Modelo', '{"type":"doc"}') returning id`;
  templateA = (await as<{ id: string }>(A, insertTemplate, [A]))[0].id;
  templateB = (await as<{ id: string }>(B, insertTemplate, [B]))[0].id;
  receiptB = await issue(B, templateB);
  await db.query("insert into storage.objects (bucket_id, name) values ('receipts', $1)", [
    `${B}/${receiptB.receipt_id}/v1.pdf`,
  ]);
}, 60_000);

describe("criação de usuário", () => {
  it("cria profile e semeia os 11 campos padrão", async () => {
    const fields = await as(A, "select key from public.fields where is_system");
    expect(fields).toHaveLength(11);
    const [profile] = await as(A, "select role, must_change_password from public.profiles");
    expect(profile).toEqual({ role: "user", must_change_password: true });
  });

  it("usuário sem username (criado fora do painel) não recebe perfil", async () => {
    const { rows } = await db.query<{ id: string }>(
      "insert into auth.users (raw_app_meta_data) values ('{}') returning id");
    const profiles = await db.query("select 1 from public.profiles where id = $1", [rows[0].id]);
    expect(profiles.rows).toEqual([]);
  });

  it("cria o perfil quando o app_metadata chega depois do insert (fluxo real do Supabase Auth)", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into auth.users (raw_app_meta_data) values ('{"provider":"email"}') returning id`);
    await db.query(
      `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"username":"tardio","display_name":"T"}'
       where id = $1`, [rows[0].id]);
    const profile = await db.query("select username, role from public.profiles where id = $1", [rows[0].id]);
    expect(profile.rows).toEqual([{ username: "tardio", role: "user" }]);
    const fields = await db.query("select 1 from public.fields where user_id = $1", [rows[0].id]);
    expect(fields.rows).toHaveLength(11);
    await db.query("delete from auth.users where id = $1", [rows[0].id]);
  });
});

describe("Usuário A contra dados do Usuário B → ACESSO NEGADO", () => {
  it("não lê recibo, versões, modelo, perfis nem arquivos de B", async () => {
    expect(await as(A, "select * from public.receipts where user_id = $1", [B])).toEqual([]);
    expect(await as(A, "select * from public.receipt_versions where user_id = $1", [B])).toEqual([]);
    expect(await as(A, "select * from public.receipt_templates where id = $1", [templateB])).toEqual([]);
    expect(await as(A, "select * from public.professional_profiles where user_id = $1", [B])).toEqual([]);
    expect(await as(A, "select * from public.profiles where id = $1", [B])).toEqual([]);
    expect(await as(A, "select * from public.fields where user_id = $1", [B])).toEqual([]);
    expect(await as(A, "select * from storage.objects")).toEqual([]);
  });

  it("não altera nem apaga modelo de B", async () => {
    expect(await as(A, "update public.receipt_templates set name = 'x' where id = $1 returning id", [templateB])).toEqual([]);
    expect(await as(A, "delete from public.receipt_templates where id = $1 returning id", [templateB])).toEqual([]);
  });

  it("não cria dados em nome de B nem transfere os próprios para B", async () => {
    await expect(as(A, `insert into public.receipt_templates (user_id, name, content) values ($1, 'x', '{}')`, [B]))
      .rejects.toThrow(/row-level security/);
    await expect(as(A, "update public.receipt_templates set user_id = $1 where id = $2", [B, templateA]))
      .rejects.toThrow(/row-level security/);
    await expect(as(A, "insert into storage.objects (bucket_id, name) values ('receipts', $1)", [`${B}/x.pdf`]))
      .rejects.toThrow(/row-level security/);
  });

  it("não emite com modelo de B, não corrige nem anexa PDF a recibo de B", async () => {
    await expect(issue(A, templateB)).rejects.toThrow(/Modelo não encontrado/);
    await expect(as(A, "select public.correct_receipt($1, '{}', '{}', null, gen_random_uuid())", [receiptB.receipt_id]))
      .rejects.toThrow(/Recibo não encontrado/);
    await expect(as(A, "select public.attach_receipt_pdf($1, $2, $3, 'x.pdf')", [
      receiptB.version_id, `${B}/${receiptB.receipt_id}/v1.pdf`, "0".repeat(64),
    ])).rejects.toThrow();
  });
});

describe("privilégios do próprio usuário", () => {
  it("não altera o próprio papel/status", async () => {
    await expect(as(A, "update public.profiles set role = 'super_admin' where id = $1", [A]))
      .rejects.toThrow(/permission denied/);
  });

  it("não acessa contadores e não escreve auditoria", async () => {
    await expect(as(A, "select * from public.receipt_counters")).rejects.toThrow(/permission denied/);
    await expect(as(A, "insert into public.audit_logs (action) values ('x.y')")).rejects.toThrow(/permission denied/);
    expect(await as(A, "select * from public.audit_logs")).toEqual([]);
  });

  it("não altera versões emitidas (imutáveis)", async () => {
    await expect(as(B, `update public.receipt_versions set "values" = '{}'`)).rejects.toThrow(/permission denied/);
  });

  it("campos: não cria campo de sistema, chave reservada, nem muda a chave", async () => {
    await expect(as(A, `insert into public.fields (user_id, key, label, type, is_system)
                        values ($1, 'novo', 'N', 'short_text', true)`, [A])).rejects.toThrow();
    await expect(as(A, `insert into public.fields (user_id, key, label, type)
                        values ($1, 'profissional_nome', 'N', 'short_text')`, [A])).rejects.toThrow();
    await expect(as(A, "update public.fields set key = 'outro' where key = 'valor'")).rejects.toThrow();
  });

  it("cria campo personalizado válido", async () => {
    const rows = await as(A, `insert into public.fields (user_id, key, label, type)
                              values ($1, 'cirurgiao', 'Nome do cirurgião', 'short_text') returning key`, [A]);
    expect(rows).toEqual([{ key: "cirurgiao" }]);
  });

  it("não inicia modo suporte", async () => {
    await expect(as(A, "select public.start_support_session($1, null)", [B])).rejects.toThrow(/Acesso negado/);
  });
});

describe("numeração, idempotência e correção", () => {
  it("numera por usuário e por ano, sem repetir", async () => {
    const first = await issue(A, templateA);
    const second = await issue(A, templateA);
    expect(first.number).toMatch(/^REC-\d{4}-\d{6}$/);
    expect(Number(second.number.slice(-6))).toBe(Number(first.number.slice(-6)) + 1);
    expect(receiptB.number.endsWith("000001")).toBe(true);
  });

  it("mesma chave de idempotência devolve o mesmo recibo", async () => {
    const key = crypto.randomUUID();
    expect(await issue(A, templateA, key)).toEqual(await issue(A, templateA, key));
  });

  it("correção gera v2 com o mesmo número e preserva a v1", async () => {
    const issued = await issue(A, templateA);
    const [{ r: corrected }] = await as<{ r: { number: string; version_no: number } }>(
      A,
      `select public.correct_receipt($1, '{"valor":200}', '{"amount_cents":200}', 'ajuste', gen_random_uuid()) as r`,
      [issued.receipt_id],
    );
    expect(corrected).toMatchObject({ number: issued.number, version_no: 2 });
    const versions = await as(A, `select version_no, "values" from public.receipt_versions
                                  where receipt_id = $1 order by version_no`, [issued.receipt_id]);
    expect(versions).toEqual([
      { version_no: 1, values: { valor: 100 } },
      { version_no: 2, values: { valor: 200 } },
    ]);
  });
});

describe("histórico: busca, filtros, ordenação e totais (Fase 8)", () => {
  const C = "00000000-0000-0000-0000-00000000000c";
  type Listed = { total: number; total_amount_cents: number; items: { number: string; payer_name: string; receipt_date: string }[] };
  const list = (uid: string, owner: string, opts: { terms?: string[]; from?: string; to?: string; template?: string; sort?: string; limit?: number; offset?: number } = {}) =>
    as<{ r: Listed }>(uid, "select public.list_receipts($1, $2, $3, $4, $5, $6, $7, $8) as r", [
      owner, opts.terms ?? [], opts.from ?? null, opts.to ?? null, opts.template ?? null, opts.sort ?? "recentes", opts.limit ?? 20, opts.offset ?? 0,
    ]).then((rows) => rows[0].r);
  const payers = (result: Listed) => result.items.map((i) => i.payer_name);

  let otherTemplate: string;

  beforeAll(async () => {
    await db.query(`insert into auth.users (id, raw_app_meta_data) values ($1, '{"username":"usuario-c","display_name":"C"}')`, [C]);
    await as(C, `insert into public.professional_profiles (user_id, full_name) values ($1, 'Profissional C')`, [C]);
    const insertTemplate = `insert into public.receipt_templates (user_id, name, content) values ($1, $2, '{"type":"doc"}') returning id`;
    const [{ id: main }] = await as<{ id: string }>(C, insertTemplate, [C, "Principal"]);
    [{ id: otherTemplate }] = await as<{ id: string }>(C, insertTemplate, [C, "Outro"]);

    const receipts = [
      { template: main, payer: "José da Silva", search: "jose da silva 52998224725 hospital central", amount: 15000, date: "2026-01-10" },
      { template: main, payer: "Ana Souza", search: "ana souza 11222333000181", amount: 50000, date: "2026-02-20" },
      { template: otherTemplate, payer: "Bruno 50% Lima", search: "bruno 50% lima", amount: 8000, date: "2026-02-25" },
    ];
    for (const r of receipts) {
      await as(C, "select public.issue_receipt($1, '{}', $2, gen_random_uuid())", [
        r.template, { payer_name: r.payer, amount_cents: r.amount, service_date: r.date, search_text: r.search },
      ]);
    }
  });

  it("lista tudo com total e soma dos valores", async () => {
    const all = await list(C, C);
    expect(all.total).toBe(3);
    expect(Number(all.total_amount_cents)).toBe(73000);
    expect(payers(all)).toEqual(["Bruno 50% Lima", "Ana Souza", "José da Silva"]); // mais recentes primeiro
  });

  it("busca: todas as palavras, número do recibo e CPF/CNPJ com ou sem pontuação", async () => {
    expect(payers(await list(C, C, { terms: ["silva", "central"] }))).toEqual(["José da Silva"]);
    expect(payers(await list(C, C, { terms: ["silva", "ana"] }))).toEqual([]);
    expect(payers(await list(C, C, { terms: ["529.982.247-25"] }))).toEqual(["José da Silva"]);
    expect(payers(await list(C, C, { terms: ["11.222.333/0001-81"] }))).toEqual(["Ana Souza"]);
    const { items } = await list(C, C, { terms: ["ana"] });
    expect(payers(await list(C, C, { terms: [items[0].number.toLowerCase()] }))).toEqual(["Ana Souza"]);
    expect(payers(await list(C, C, { terms: [items[0].number.slice(4)] }))).toEqual(["Ana Souza"]); // "2026-000002"
  });

  it("curingas digitados são literais", async () => {
    expect(payers(await list(C, C, { terms: ["%"] }))).toEqual(["Bruno 50% Lima"]);
    expect(payers(await list(C, C, { terms: ["_"] }))).toEqual([]);
  });

  it("filtra por período (data do recibo) e por modelo", async () => {
    expect(payers(await list(C, C, { from: "2026-02-01", to: "2026-02-28" })).sort()).toEqual(["Ana Souza", "Bruno 50% Lima"]);
    expect(payers(await list(C, C, { to: "2026-01-31" }))).toEqual(["José da Silva"]);
    const byTemplate = await list(C, C, { template: otherTemplate });
    expect(payers(byTemplate)).toEqual(["Bruno 50% Lima"]);
    expect(Number(byTemplate.total_amount_cents)).toBe(8000);
  });

  it("ordena por valor, pagador, data do atendimento e mais antigos", async () => {
    expect(payers(await list(C, C, { sort: "valor" }))).toEqual(["Ana Souza", "José da Silva", "Bruno 50% Lima"]);
    expect(payers(await list(C, C, { sort: "pagador" }))).toEqual(["Ana Souza", "Bruno 50% Lima", "José da Silva"]);
    expect(payers(await list(C, C, { sort: "data" }))).toEqual(["Bruno 50% Lima", "Ana Souza", "José da Silva"]);
    expect(payers(await list(C, C, { sort: "antigos" }))).toEqual(["José da Silva", "Ana Souza", "Bruno 50% Lima"]);
    expect(payers(await list(C, C, { sort: "'; drop table x; --" }))).toHaveLength(3); // desconhecido = padrão
  });

  it("pagina sem perder o total", async () => {
    const page2 = await list(C, C, { sort: "pagador", limit: 2, offset: 2 });
    expect(page2.total).toBe(3);
    expect(payers(page2)).toEqual(["José da Silva"]);
  });

  // C só existe neste bloco: os testes de administração contam usuários.
  afterAll(async () => {
    await db.query("delete from auth.users where id = $1", [C]);
  });

  it("não lista recibos de outro usuário, nem pedindo pelo id dele", async () => {
    const stolen = await list(A, C);
    expect(stolen.total).toBe(0);
    expect(stolen.items).toEqual([]);
    await expect(as(A, "select public.list_receipts($1)", [C])).resolves.toBeDefined();
    const anon = db.exec("set role anon; select public.list_receipts('00000000-0000-0000-0000-00000000000c')");
    await expect(anon).rejects.toThrow(/permission denied/);
    await db.exec("reset role;");
  });
});

describe("modo suporte do Super Admin (somente leitura, auditado)", () => {
  it("só lê o alvo durante a sessão e registra início/fim", async () => {
    const receiptsOf = (uid: string) => as(ADMIN, "select id from public.receipts where user_id = $1", [uid]);

    expect(await receiptsOf(B)).toEqual([]);
    const [{ id: sessionId }] = await as<{ id: string }>(ADMIN, "select public.start_support_session($1, 'suporte') as id", [B]);

    expect(await receiptsOf(B)).toHaveLength(1);
    expect(await receiptsOf(A)).toEqual([]);
    expect(await as(ADMIN, "select * from storage.objects")).toHaveLength(1);
    expect(await as(ADMIN, "update public.receipt_templates set name = 'x' where id = $1 returning id", [templateB])).toEqual([]);

    await as(ADMIN, "select public.end_support_session()");
    expect(await receiptsOf(B)).toEqual([]);

    const audit = await db.query<{ action: string }>(
      "select action from public.audit_logs where entity_id = $1 order by id", [sessionId]);
    expect(audit.rows.map((r) => r.action)).toEqual(["admin.support.start", "admin.support.end"]);
  });
});

describe("administração de usuários (Fase 2)", () => {
  type ListedUser = { username: string; total_count: string };
  const list = (uid: string, search: string | null = null, status: string | null = null) =>
    as<ListedUser>(uid, "select username, total_count from public.admin_list_users($1, $2)", [search, status]);

  it("usuário comum não usa nenhuma função administrativa", async () => {
    await expect(list(A)).rejects.toThrow(/Acesso negado/);
    await expect(as(A, "select public.admin_get_user($1)", [B])).rejects.toThrow(/Acesso negado/);
    await expect(as(A, "select public.admin_user_stats()")).rejects.toThrow(/Acesso negado/);
  });

  it("ninguém logado revoga sessões — só o servidor (service role)", async () => {
    await expect(as(ADMIN, "select public.admin_revoke_sessions($1)", [A])).rejects.toThrow(/permission denied/);
    await expect(as(A, "select public.admin_revoke_sessions($1)", [B])).rejects.toThrow(/permission denied/);
  });

  it("lista só usuários comuns, com total para paginação", async () => {
    const rows = await list(ADMIN);
    expect(rows.map((r) => r.username).sort()).toEqual(["usuario-a", "usuario-b"]);
    expect(Number(rows[0].total_count)).toBe(2);
  });

  it("busca sem acento e sem diferenciar maiúsculas; curingas digitados são literais", async () => {
    await db.query("update public.profiles set display_name = 'Mariana Conceição' where id = $1", [B]);
    expect((await list(ADMIN, "CONCEICAO")).map((r) => r.username)).toEqual(["usuario-b"]);
    expect((await list(ADMIN, "usuario-a")).map((r) => r.username)).toEqual(["usuario-a"]);
    expect(await list(ADMIN, "%")).toEqual([]);
    expect(await list(ADMIN, "_")).toEqual([]);
  });

  it("filtra por situação e resume contagens", async () => {
    await db.query("update public.profiles set status = 'disabled' where id = $1", [B]);
    expect((await list(ADMIN, null, "disabled")).map((r) => r.username)).toEqual(["usuario-b"]);
    const [{ s }] = await as<{ s: Record<string, number> }>(ADMIN, "select public.admin_user_stats() as s");
    expect(s).toMatchObject({ total: 2, active: 1, disabled: 1 });
    await db.query("update public.profiles set status = 'active' where id = $1", [B]);
  });

  it("auditoria: só super admin lê; filtra por ação, usuário e período; traz o motivo do suporte", async () => {
    type AuditRow = { action: string; target_username: string | null; support_reason: string | null; total_count: string };
    const audit = (uid: string, ...args: unknown[]) =>
      as<AuditRow>(uid, "select * from public.admin_list_audit($1, $2, $3, $4)", [...args, null, null, null, null].slice(0, 4));

    await expect(audit(A)).rejects.toThrow(/Acesso negado/);
    await expect(as(A, "select * from public.support_sessions")).resolves.toEqual([]);

    const support = await audit(ADMIN, "admin.support");
    expect(support.map((r) => r.action)).toEqual(["admin.support.end", "admin.support.start"]);
    expect(support.every((r) => r.support_reason === "suporte" && r.target_username === "usuario-b")).toBe(true);
    expect(Number(support[0].total_count)).toBe(2);

    expect(await audit(ADMIN, null, A)).toEqual([]);
    expect(await audit(ADMIN, "admin.support", B, "2999-01-01")).toEqual([]);
    expect(await audit(ADMIN, "admin.sup")).toEqual([]); // prefixo casa por segmento inteiro
    expect((await audit(ADMIN, "admin.support.start")).map((r) => r.action)).toEqual(["admin.support.start"]);
  });

  it("detalhe não expõe o próprio admin nem outros admins", async () => {
    expect(await as(ADMIN, "select * from public.admin_get_user($1)", [ADMIN])).toEqual([]);
    const [user] = await as<{ username: string }>(ADMIN, "select * from public.admin_get_user($1)", [A]);
    expect(user.username).toBe("usuario-a");
  });

  it("revogar sessões apaga todas as sessões do usuário", async () => {
    await db.query("insert into auth.sessions (user_id) values ($1), ($1)", [A]);
    const { rows } = await db.query<{ n: number }>("select public.admin_revoke_sessions($1) as n", [A]);
    expect(rows[0].n).toBe(2);
  });
});

describe("limites de tentativas (Fase 10)", () => {
  const hit = (key: string, max = 3, windowSeconds = 60) =>
    db.query<{ ok: boolean }>("select public.rate_limit_hit($1, $2, $3) as ok", [key, max, windowSeconds]).then((r) => r.rows[0].ok);

  it("conta por chave e recusa acima do limite", async () => {
    expect([await hit("teste:a"), await hit("teste:a"), await hit("teste:a"), await hit("teste:a")]).toEqual([true, true, true, false]);
    expect(await hit("teste:b")).toBe(true); // outra chave, outro contador
  });

  it("zera quando a janela passa", async () => {
    await db.query("update private.rate_limits set window_start = now() - interval '2 minutes' where key = 'teste:a'");
    expect(await hit("teste:a")).toBe(true);
  });

  it("nenhum usuário logado usa, lê ou zera o contador", async () => {
    await expect(as(A, "select public.rate_limit_hit('x', 1000, 1)")).rejects.toThrow(/permission denied/);
    await expect(as(A, "select * from private.rate_limits")).rejects.toThrow(/permission denied/);
    await expect(as(A, "delete from private.rate_limits")).rejects.toThrow(/permission denied/);
  });
});

describe("conta desativada e exclusão (LGPD)", () => {
  it("conta desativada perde acesso aos próprios dados", async () => {
    await db.query("update public.profiles set status = 'disabled' where id = $1", [A]);
    expect(await as(A, "select * from public.receipt_templates")).toEqual([]);
    await db.query("update public.profiles set status = 'active' where id = $1", [A]);
  });

  it("lista todos os arquivos do usuário (e só dele) e esquece os contadores dele — só o servidor", async () => {
    await db.query("insert into storage.objects (bucket_id, name) values ('logos', $1), ('logos', $2)", [
      `${B}/logo.png`,
      `${A}/logo.png`,
    ]);
    await db.query("insert into private.rate_limits values ($1, now(), 1), ($2, now(), 1), ($3, now(), 1)", [
      `pdfPreview:${B}`,
      `receiptIssue:${B}`,
      `pdfPreview:${A}`,
    ]);

    const { rows: files } = await db.query<{ bucket_id: string; name: string }>(
      "select * from public.admin_user_storage_objects($1)", [B]);
    expect(files).toEqual([
      { bucket_id: "logos", name: `${B}/logo.png` },
      { bucket_id: "receipts", name: `${B}/${receiptB.receipt_id}/v1.pdf` },
    ]);
    const { rows: [{ n }] } = await db.query<{ n: number }>("select public.admin_forget_rate_limits($1) as n", [B]);
    expect(n).toBe(2);
    const { rows: left } = await db.query<{ key: string }>("select key from private.rate_limits where key like '%' || $1", [A]);
    expect(left.map((r) => r.key)).toEqual([`pdfPreview:${A}`]);

    await expect(as(A, "select * from public.admin_user_storage_objects($1)", [B])).rejects.toThrow(/permission denied/);
    await expect(as(ADMIN, "select * from public.admin_user_storage_objects($1)", [B])).rejects.toThrow(/permission denied/);
    await expect(as(ADMIN, "select public.admin_forget_rate_limits($1)", [B])).rejects.toThrow(/permission denied/);
  });

  it("excluir usuário apaga tudo dele e mantém auditoria anonimizada", async () => {
    await db.query("delete from auth.users where id = $1", [ADMIN]);
    const audit = await db.query<{ actor_id: string | null }>("select actor_id from public.audit_logs");
    expect(audit.rows.length).toBeGreaterThan(0);
    expect(audit.rows.every((r) => r.actor_id === null)).toBe(true);

    await db.query("delete from storage.objects");
    await db.query("delete from auth.users where id = $1", [B]);
    const [{ n }] = (await db.query<{ n: number }>(
      "select count(*)::int as n from public.receipts where user_id = $1", [B])).rows;
    expect(n).toBe(0);
  });
});
