-- =============================================================================
-- MeuRecibo — Operações atômicas (RPC)
-- Todas: security definer, search_path vazio, verificam auth.uid() internamente,
-- executáveis apenas por "authenticated".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Snapshots
-- -----------------------------------------------------------------------------
create function private.template_snapshot(p_template public.receipt_templates)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'template_id', p_template.id,
    'name', p_template.name,
    'revision', p_template.revision,
    'content', p_template.content,
    'settings', p_template.settings,
    'used_variables', to_jsonb(p_template.used_variables)
  );
$$;

create function private.profile_snapshot(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select (to_jsonb(pp) - 'created_at' - 'updated_at' - 'onboarding_completed_at')
    || jsonb_build_object(
      'logo', (
        select jsonb_build_object('bucket', a.bucket, 'path', a.storage_path,
                                  'width', a.width, 'height', a.height)
        from public.user_assets a where a.id = pp.logo_asset_id
      ),
      'signature', (
        select jsonb_build_object('bucket', a.bucket, 'path', a.storage_path,
                                  'width', a.width, 'height', a.height)
        from public.user_assets a where a.id = pp.signature_asset_id
      )
    )
  from public.professional_profiles pp
  where pp.user_id = p_user_id;
$$;

create function private.assert_active_caller()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not private.is_active_user() then
    raise exception 'Acesso negado' using errcode = 'insufficient_privilege';
  end if;
  return v_uid;
end;
$$;

-- Resultado padrão das RPCs de emissão (usado também na idempotência).
create function private.version_result(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'receipt_id', r.id,
    'version_id', v.id,
    'version_no', v.version_no,
    'number', r.number
  )
  from public.receipt_versions v
  join public.receipts r on r.id = v.receipt_id
  where v.id = p_version_id;
$$;

-- -----------------------------------------------------------------------------
-- issue_receipt — aloca número (sem colisão), cria recibo + versão 1 com snapshots.
-- Valores e resumo chegam já validados pelo servidor da aplicação (Zod).
-- p_summary: { payer_name, amount_cents, service_date, search_text }
-- -----------------------------------------------------------------------------
create function public.issue_receipt(
  p_template_id uuid,
  p_values jsonb,
  p_summary jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_caller();
  v_existing uuid;
  v_template public.receipt_templates;
  v_timezone text;
  v_year integer;
  v_sequence integer;
  v_receipt_id uuid;
  v_version_id uuid;
begin
  if p_idempotency_key is null or jsonb_typeof(p_values) is distinct from 'object' then
    raise exception 'Dados inválidos' using errcode = 'invalid_parameter_value';
  end if;

  -- Duplo toque / reenvio: devolve o recibo já criado com a mesma chave.
  select v.id into v_existing
  from public.receipt_versions v
  where v.user_id = v_uid and v.idempotency_key = p_idempotency_key;
  if found then
    return private.version_result(v_existing);
  end if;

  select * into v_template
  from public.receipt_templates t
  where t.id = p_template_id and t.user_id = v_uid and t.status = 'active';
  if not found then
    raise exception 'Modelo não encontrado' using errcode = 'no_data_found';
  end if;

  select pp.timezone into v_timezone
  from public.professional_profiles pp
  where pp.user_id = v_uid;
  if not found then
    raise exception 'Complete seu perfil profissional antes de emitir' using errcode = 'no_data_found';
  end if;

  v_year := extract(year from (now() at time zone v_timezone))::integer;

  -- A linha do contador fica travada até o fim da transação → sem colisão.
  insert into public.receipt_counters as c (user_id, year, last_value)
  values (v_uid, v_year, 1)
  on conflict (user_id, year) do update set last_value = c.last_value + 1
  returning c.last_value into v_sequence;

  insert into public.receipts (
    user_id, template_id, number, year, sequence, template_name,
    payer_name, amount_cents, service_date, search_text
  )
  values (
    v_uid, v_template.id,
    format('REC-%s-%s', v_year, lpad(v_sequence::text, 6, '0')),
    v_year, v_sequence, v_template.name,
    left(nullif(trim(p_summary ->> 'payer_name'), ''), 200),
    (p_summary ->> 'amount_cents')::bigint,
    (p_summary ->> 'service_date')::date,
    left(coalesce(p_summary ->> 'search_text', ''), 4000)
  )
  returning id into v_receipt_id;

  insert into public.receipt_versions (
    receipt_id, user_id, version_no, template_snapshot, profile_snapshot, "values", idempotency_key
  )
  values (
    v_receipt_id, v_uid, 1,
    private.template_snapshot(v_template),
    private.profile_snapshot(v_uid),
    p_values, p_idempotency_key
  )
  returning id into v_version_id;

  update public.receipts set current_version_id = v_version_id where id = v_receipt_id;

  return private.version_result(v_version_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- correct_receipt — "Corrigir recibo": nova versão com o mesmo número.
-- Mantém o layout da versão anterior; usa o perfil profissional atual.
-- -----------------------------------------------------------------------------
create function public.correct_receipt(
  p_receipt_id uuid,
  p_values jsonb,
  p_summary jsonb,
  p_note text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_caller();
  v_existing uuid;
  v_receipt public.receipts;
  v_template_snapshot jsonb;
  v_version_id uuid;
begin
  if p_idempotency_key is null or jsonb_typeof(p_values) is distinct from 'object' then
    raise exception 'Dados inválidos' using errcode = 'invalid_parameter_value';
  end if;

  select v.id into v_existing
  from public.receipt_versions v
  where v.user_id = v_uid and v.idempotency_key = p_idempotency_key;
  if found then
    return private.version_result(v_existing);
  end if;

  select * into v_receipt
  from public.receipts r
  where r.id = p_receipt_id and r.user_id = v_uid
  for update;
  if not found then
    raise exception 'Recibo não encontrado' using errcode = 'no_data_found';
  end if;
  if v_receipt.status = 'cancelled' then
    raise exception 'Recibo cancelado não pode ser corrigido' using errcode = 'check_violation';
  end if;

  select v.template_snapshot into v_template_snapshot
  from public.receipt_versions v
  where v.id = v_receipt.current_version_id;

  insert into public.receipt_versions (
    receipt_id, user_id, version_no, template_snapshot, profile_snapshot,
    "values", idempotency_key, correction_note
  )
  values (
    v_receipt.id, v_uid, v_receipt.current_version_no + 1,
    v_template_snapshot, private.profile_snapshot(v_uid),
    p_values, p_idempotency_key, left(nullif(trim(p_note), ''), 500)
  )
  returning id into v_version_id;

  update public.receipts set
    current_version_id = v_version_id,
    current_version_no = v_receipt.current_version_no + 1,
    payer_name = left(nullif(trim(p_summary ->> 'payer_name'), ''), 200),
    amount_cents = (p_summary ->> 'amount_cents')::bigint,
    service_date = (p_summary ->> 'service_date')::date,
    search_text = left(coalesce(p_summary ->> 'search_text', ''), 4000)
  where id = v_receipt.id;

  return private.version_result(v_version_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- attach_receipt_pdf — grava o PDF de uma versão UMA única vez.
-- -----------------------------------------------------------------------------
create function public.attach_receipt_pdf(
  p_version_id uuid,
  p_pdf_path text,
  p_pdf_sha256 text,
  p_file_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_caller();
begin
  if split_part(p_pdf_path, '/', 1) <> v_uid::text or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'receipts' and o.name = p_pdf_path
  ) then
    raise exception 'Arquivo do recibo inválido' using errcode = 'check_violation';
  end if;

  update public.receipt_versions
  set pdf_path = p_pdf_path, pdf_sha256 = p_pdf_sha256, file_name = p_file_name
  where id = p_version_id and user_id = v_uid and pdf_path is null;

  if not found then
    raise exception 'Versão não encontrada ou já possui PDF' using errcode = 'check_violation';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Modo suporte (somente leitura). A sessão aberta no banco É o estado do modo
-- suporte: não há cookie nem troca de user_id no cliente.
-- -----------------------------------------------------------------------------
create function public.start_support_session(p_target_user_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
begin
  if not private.is_super_admin() then
    raise exception 'Acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_target_user_id and p.role = 'user'
  ) then
    raise exception 'Usuário não encontrado' using errcode = 'no_data_found';
  end if;

  update public.support_sessions set ended_at = now()
  where admin_id = v_uid and ended_at is null;

  insert into public.support_sessions (admin_id, target_user_id, reason)
  values (v_uid, p_target_user_id, left(nullif(trim(p_reason), ''), 300))
  returning id into v_session_id;

  insert into public.audit_logs (actor_id, action, target_user_id, entity_type, entity_id)
  values (v_uid, 'admin.support.start', p_target_user_id, 'support_session', v_session_id);

  return v_session_id;
end;
$$;

create function public.end_support_session()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.support_sessions;
begin
  if not private.is_super_admin() then
    raise exception 'Acesso negado' using errcode = 'insufficient_privilege';
  end if;

  update public.support_sessions set ended_at = now()
  where admin_id = v_uid and ended_at is null
  returning * into v_session;

  if found then
    insert into public.audit_logs (actor_id, action, target_user_id, entity_type, entity_id)
    values (v_uid, 'admin.support.end', v_session.target_user_id, 'support_session', v_session.id);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke all on function private.template_snapshot(public.receipt_templates) from public, anon, authenticated;
revoke all on function private.profile_snapshot(uuid) from public, anon, authenticated;
revoke all on function private.assert_active_caller() from public, anon, authenticated;
revoke all on function private.version_result(uuid) from public, anon, authenticated;

revoke all on function public.issue_receipt(uuid, jsonb, jsonb, uuid) from public, anon;
revoke all on function public.correct_receipt(uuid, jsonb, jsonb, text, uuid) from public, anon;
revoke all on function public.attach_receipt_pdf(uuid, text, text, text) from public, anon;
revoke all on function public.start_support_session(uuid, text) from public, anon;
revoke all on function public.end_support_session() from public, anon;

grant execute on function public.issue_receipt(uuid, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.correct_receipt(uuid, jsonb, jsonb, text, uuid) to authenticated;
grant execute on function public.attach_receipt_pdf(uuid, text, text, text) to authenticated;
grant execute on function public.start_support_session(uuid, text) to authenticated;
grant execute on function public.end_support_session() to authenticated;
