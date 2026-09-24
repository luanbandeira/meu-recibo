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
import { beforeAll, describe, expect, it } from "vitest";

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
    await db.query("update public.profiles set display_name = 'Mariana Souza' where id = $1", [B]);
    expect((await list(ADMIN, "SOUZA")).map((r) => r.username)).toEqual(["usuario-b"]);
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

describe("conta desativada e exclusão (LGPD)", () => {
  it("conta desativada perde acesso aos próprios dados", async () => {
    await db.query("update public.profiles set status = 'disabled' where id = $1", [A]);
    expect(await as(A, "select * from public.receipt_templates")).toEqual([]);
    await db.query("update public.profiles set status = 'active' where id = $1", [A]);
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
