/**
 * Isolamento entre usuários garantido pelo BANCO (RLS + privilégios + RPCs).
 * Roda contra o projeto Supabase de desenvolvimento com usuários fictícios
 * criados e removidos pelo próprio teste.
 *
 * Regra obrigatória: "Usuário A tenta acessar recibo do Usuário B" → ACESSO NEGADO.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EMPTY_DOC,
  TINY_PDF,
  adminClient,
  anonClient,
  createTestUser,
  hasSupabaseEnv,
  purgeTestAuditLogs,
  type TestUser,
} from "./helpers";

describe.skipIf(!hasSupabaseEnv)("Isolamento entre usuários (RLS)", () => {
  let admin: SupabaseClient;
  let userA: TestUser;
  let userB: TestUser;
  let superAdmin: TestUser;
  let templateA: string;
  let templateB: string;
  let receiptB: { receipt_id: string; version_id: string; number: string };
  const pdfPathB = () => `${userB.id}/teste/v1.pdf`;
  const created: string[] = [];

  async function setupUser(user: TestUser) {
    const { error: profileError } = await user.client
      .from("professional_profiles")
      .insert({ user_id: user.id, full_name: `Profissional ${user.username}`, city: "Recife", state: "PE" });
    if (profileError) throw profileError;

    const { data, error } = await user.client
      .from("receipt_templates")
      .insert({ user_id: user.id, name: "Modelo de teste", content: EMPTY_DOC })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  function issue(client: SupabaseClient, templateId: string, key = randomUUID()) {
    return client.rpc("issue_receipt", {
      p_template_id: templateId,
      p_values: { pagador: "Pagador Fictício", valor: 50000 },
      p_summary: { payer_name: "Pagador Fictício", amount_cents: 50000, search_text: "pagador ficticio" },
      p_idempotency_key: key,
    });
  }

  beforeAll(async () => {
    admin = adminClient();
    userA = await createTestUser(admin, "a", created);
    userB = await createTestUser(admin, "b", created);
    superAdmin = await createTestUser(admin, "adm", created, "super_admin");

    templateA = await setupUser(userA);
    templateB = await setupUser(userB);

    const { data, error } = await issue(userB.client, templateB);
    if (error) throw error;
    receiptB = data;

    const { error: uploadError } = await userB.client.storage
      .from("receipts")
      .upload(pdfPathB(), TINY_PDF, { contentType: "application/pdf" });
    if (uploadError) throw uploadError;
  });

  afterAll(async () => {
    if (!admin) return;
    if (userB) await admin.storage.from("receipts").remove([pdfPathB()]).catch(() => {});
    await purgeTestAuditLogs(created);
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  describe("Usuário A contra dados do Usuário B", () => {
    it("NÃO lê o recibo de B", async () => {
      const { data, error } = await userA.client.from("receipts").select("*").eq("id", receiptB.receipt_id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("NÃO lê as versões do recibo de B", async () => {
      const { data } = await userA.client.from("receipt_versions").select("*").eq("receipt_id", receiptB.receipt_id);
      expect(data).toEqual([]);
    });

    it("NÃO baixa o PDF de B do storage", async () => {
      const { data, error } = await userA.client.storage.from("receipts").download(pdfPathB());
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("NÃO gera URL assinada para o PDF de B", async () => {
      const { data, error } = await userA.client.storage.from("receipts").createSignedUrl(pdfPathB(), 60);
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("NÃO envia arquivo para a pasta de B", async () => {
      const { error } = await userA.client.storage
        .from("receipts")
        .upload(`${userB.id}/invasao.pdf`, TINY_PDF, { contentType: "application/pdf" });
      expect(error).not.toBeNull();
    });

    it("NÃO lê perfil profissional nem perfil de B", async () => {
      const professional = await userA.client.from("professional_profiles").select("*").eq("user_id", userB.id);
      const profile = await userA.client.from("profiles").select("*").eq("id", userB.id);
      expect(professional.data).toEqual([]);
      expect(profile.data).toEqual([]);
    });

    it("NÃO lê, altera nem apaga modelo de B", async () => {
      const read = await userA.client.from("receipt_templates").select("*").eq("id", templateB);
      expect(read.data).toEqual([]);

      const update = await userA.client
        .from("receipt_templates")
        .update({ name: "invadido" })
        .eq("id", templateB)
        .select();
      expect(update.data ?? []).toEqual([]);

      const remove = await userA.client.from("receipt_templates").delete().eq("id", templateB).select();
      expect(remove.data ?? []).toEqual([]);

      const { data: still } = await admin.from("receipt_templates").select("name").eq("id", templateB).single();
      expect(still?.name).toBe("Modelo de teste");
    });

    it("NÃO cria modelo em nome de B", async () => {
      const { error } = await userA.client
        .from("receipt_templates")
        .insert({ user_id: userB.id, name: "forjado", content: EMPTY_DOC });
      expect(error?.code).toBe("42501");
    });

    it("NÃO transfere o próprio modelo para B", async () => {
      const { error } = await userA.client
        .from("receipt_templates")
        .update({ user_id: userB.id })
        .eq("id", templateA);
      expect(error?.code).toBe("42501");
    });

    it("NÃO lê campos personalizados de B", async () => {
      const { data } = await userA.client.from("fields").select("*").eq("user_id", userB.id);
      expect(data).toEqual([]);
    });

    it("NÃO emite recibo usando modelo de B", async () => {
      const { error } = await issue(userA.client, templateB);
      expect(error).not.toBeNull();
    });

    it("NÃO corrige recibo de B", async () => {
      const { error } = await userA.client.rpc("correct_receipt", {
        p_receipt_id: receiptB.receipt_id,
        p_values: { pagador: "x" },
        p_summary: {},
        p_note: "tentativa",
        p_idempotency_key: randomUUID(),
      });
      expect(error).not.toBeNull();
    });

    it("NÃO anexa PDF à versão de B", async () => {
      const { error } = await userA.client.rpc("attach_receipt_pdf", {
        p_version_id: receiptB.version_id,
        p_pdf_path: pdfPathB(),
        p_pdf_sha256: "0".repeat(64),
        p_file_name: "x.pdf",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("Storage: limites dos buckets e imutabilidade", () => {
    it("recusa tipo de arquivo não permitido no bucket de assinaturas", async () => {
      const html = new Blob(["<script>alert(1)</script>"], { type: "text/html" });
      const { error } = await userA.client.storage
        .from("signatures")
        .upload(`${userA.id}/${randomUUID()}.png`, html, { contentType: "text/html" });
      expect(error).not.toBeNull();
    });

    it("recusa arquivo acima do limite do bucket de logos (2 MB)", async () => {
      const big = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" });
      const { error } = await userA.client.storage
        .from("logos")
        .upload(`${userA.id}/${randomUUID()}.png`, big, { contentType: "image/png" });
      expect(error).not.toBeNull();
    });

    it("não sobrescreve nem apaga arquivo já enviado", async () => {
      const path = `${userB.id}/teste/v1.pdf`;
      const overwrite = await userB.client.storage
        .from("receipts")
        .upload(path, TINY_PDF, { contentType: "application/pdf", upsert: true });
      expect(overwrite.error).not.toBeNull();
      const remove = await userB.client.storage.from("receipts").remove([path]);
      expect(remove.data ?? []).toEqual([]);
      const still = await userB.client.storage.from("receipts").download(path);
      expect(still.error).toBeNull();
    });
  });

  describe("Privilégios do próprio usuário", () => {
    it("NÃO altera o próprio papel nem status", async () => {
      const { error } = await userA.client.from("profiles").update({ role: "super_admin" }).eq("id", userA.id);
      expect(error).not.toBeNull();
      const { data } = await admin.from("profiles").select("role").eq("id", userA.id).single();
      expect(data?.role).toBe("user");
    });

    it("NÃO acessa contadores nem auditoria", async () => {
      const counters = await userA.client.from("receipt_counters").select("*");
      expect(counters.error).not.toBeNull();
      const audit = await userA.client.from("audit_logs").select("*");
      expect(audit.data ?? []).toEqual([]);
    });

    it("NÃO inicia modo suporte", async () => {
      const { error } = await userA.client.rpc("start_support_session", {
        p_target_user_id: userB.id,
        p_reason: "tentativa",
      });
      expect(error).not.toBeNull();
    });

    it("recebe os campos padrão no primeiro acesso", async () => {
      const { data } = await userA.client.from("fields").select("key").eq("is_system", true);
      expect(data?.map((f) => f.key)).toEqual(
        expect.arrayContaining(["valor", "pagador", "paciente", "data_emissao"]),
      );
    });
  });

  describe("Visitante sem login", () => {
    it("NÃO lê nenhuma tabela", async () => {
      const anon = anonClient();
      for (const table of ["profiles", "receipts", "receipt_templates", "professional_profiles"]) {
        const { data } = await anon.from(table).select("*");
        expect(data ?? []).toEqual([]);
      }
    });
  });

  describe("Numeração e idempotência", () => {
    it("emissões simultâneas recebem números distintos e sequenciais", async () => {
      const results = await Promise.all(Array.from({ length: 8 }, () => issue(userA.client, templateA)));
      results.forEach((r) => expect(r.error).toBeNull());
      const numbers = results.map((r) => r.data.number as string);
      expect(new Set(numbers).size).toBe(8);
      const sequences = numbers.map((n) => Number(n.split("-")[2])).sort((a, b) => a - b);
      expect(sequences).toEqual(Array.from({ length: 8 }, (_, i) => sequences[0] + i));
      expect(numbers[0]).toMatch(/^REC-\d{4}-\d{6}$/);
    });

    it("a mesma chave de idempotência devolve o mesmo recibo", async () => {
      const key = randomUUID();
      const first = await issue(userA.client, templateA, key);
      const second = await issue(userA.client, templateA, key);
      expect(second.data).toEqual(first.data);
    });

    it("correção cria versão 2 com o mesmo número e preserva a versão 1", async () => {
      const { data: issued } = await issue(userA.client, templateA);
      const { data: corrected, error } = await userA.client.rpc("correct_receipt", {
        p_receipt_id: issued.receipt_id,
        p_values: { pagador: "Nome Corrigido", valor: 60000 },
        p_summary: { payer_name: "Nome Corrigido", amount_cents: 60000 },
        p_note: "nome errado",
        p_idempotency_key: randomUUID(),
      });
      expect(error).toBeNull();
      expect(corrected.number).toBe(issued.number);
      expect(corrected.version_no).toBe(2);

      const { data: versions } = await userA.client
        .from("receipt_versions")
        .select("version_no, values")
        .eq("receipt_id", issued.receipt_id)
        .order("version_no");
      expect(versions?.map((v) => v.version_no)).toEqual([1, 2]);
      expect(versions?.[0].values.pagador).toBe("Pagador Fictício");
    });

    it("versões emitidas são imutáveis", async () => {
      const { error } = await userB.client
        .from("receipt_versions")
        .update({ values: { pagador: "adulterado" } })
        .eq("id", receiptB.version_id);
      expect(error).not.toBeNull();
    });
  });

  describe("Modo suporte do Super Admin", () => {
    it("sem sessão de suporte, o admin NÃO lê dados de B", async () => {
      const { data } = await superAdmin.client.from("receipts").select("*").eq("user_id", userB.id);
      expect(data).toEqual([]);
    });

    it("com sessão de suporte lê B (somente leitura) e tudo é auditado", async () => {
      const { data: sessionId, error } = await superAdmin.client.rpc("start_support_session", {
        p_target_user_id: userB.id,
        p_reason: "teste automatizado",
      });
      expect(error).toBeNull();

      const read = await superAdmin.client.from("receipts").select("id").eq("user_id", userB.id);
      expect(read.data?.map((r) => r.id)).toContain(receiptB.receipt_id);

      const pdf = await superAdmin.client.storage.from("receipts").download(pdfPathB());
      expect(pdf.error).toBeNull();

      const write = await superAdmin.client
        .from("receipt_templates")
        .update({ name: "alterado pelo admin" })
        .eq("id", templateB)
        .select();
      expect(write.data ?? []).toEqual([]);

      const other = await superAdmin.client.from("receipts").select("id").eq("user_id", userA.id);
      expect(other.data).toEqual([]);

      await superAdmin.client.rpc("end_support_session");
      const after = await superAdmin.client.from("receipts").select("id").eq("user_id", userB.id);
      expect(after.data).toEqual([]);

      const { data: audit } = await admin
        .from("audit_logs")
        .select("action")
        .eq("entity_id", sessionId)
        .order("id");
      expect(audit?.map((a) => a.action)).toEqual(["admin.support.start", "admin.support.end"]);
    });
  });

  describe("Conta desativada", () => {
    it("perde acesso aos próprios dados mesmo com o token ainda válido", async () => {
      await admin.from("profiles").update({ status: "disabled" }).eq("id", userA.id);
      const { data } = await userA.client.from("receipt_templates").select("id");
      expect(data).toEqual([]);
      await admin.from("profiles").update({ status: "active" }).eq("id", userA.id);
    });
  });
});
