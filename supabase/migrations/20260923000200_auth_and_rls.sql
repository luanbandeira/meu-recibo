-- =============================================================================
-- MeuRecibo — Criação de perfil a partir do Auth, campos padrão e RLS
-- Regra fundamental: Usuário A nunca lê/cria/altera/apaga dados do Usuário B.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Campos padrão de emissão (semeados para cada usuário comum)
-- -----------------------------------------------------------------------------
create function private.seed_default_fields(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.fields (user_id, key, label, type, required, is_system, sort_order)
  values
    (p_user_id, 'valor',             'Valor',                  'currency',   true,  true, 10),
    (p_user_id, 'pagador',           'Nome do pagador',        'short_text', true,  true, 20),
    (p_user_id, 'cpf_pagador',       'CPF/CNPJ do pagador',    'document',   false, true, 30),
    (p_user_id, 'paciente',          'Nome do paciente',       'short_text', false, true, 40),
    (p_user_id, 'cpf_paciente',      'CPF do paciente',        'document',   false, true, 50),
    (p_user_id, 'cirurgia',          'Cirurgia / procedimento','short_text', false, true, 60),
    (p_user_id, 'hospital',          'Hospital',               'short_text', false, true, 70),
    (p_user_id, 'data_procedimento', 'Data do procedimento',   'date',       false, true, 80),
    (p_user_id, 'descricao_servico', 'Descrição do serviço',   'long_text',  false, true, 90),
    (p_user_id, 'cidade',            'Cidade',                 'short_text', true,  true, 100),
    (p_user_id, 'data_emissao',      'Data de emissão',        'date',       true,  true, 110)
  on conflict (user_id, key) do nothing;
$$;

-- -----------------------------------------------------------------------------
-- auth.users → profiles. Usuários só nascem pela Admin API (service role), que é
-- a única forma de preencher app_metadata; por isso esses dados são confiáveis.
-- -----------------------------------------------------------------------------
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(trim(new.raw_app_meta_data ->> 'username'));
  v_display_name text := nullif(trim(new.raw_app_meta_data ->> 'display_name'), '');
  v_role public.user_role := coalesce(
    (new.raw_app_meta_data ->> 'role')::public.user_role, 'user'
  );
  v_created_by uuid := nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid;
begin
  if v_username is null or v_username = '' then
    raise exception 'Usuários devem ser criados pelo painel administrativo do MeuRecibo';
  end if;

  insert into public.profiles (id, username, display_name, role, created_by)
  values (new.id, v_username, coalesce(v_display_name, v_username), v_role, v_created_by);

  if v_role = 'user' then
    perform private.seed_default_fields(new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Integridade entre donos: referências a assets precisam ser do mesmo usuário
-- -----------------------------------------------------------------------------
create function private.check_asset_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'professional_profiles' then
    if new.logo_asset_id is not null and not exists (
      select 1 from public.user_assets a
      where a.id = new.logo_asset_id and a.user_id = new.user_id and a.kind = 'logo'
    ) then
      raise exception 'Logo inválida' using errcode = 'check_violation';
    end if;
    if new.signature_asset_id is not null and not exists (
      select 1 from public.user_assets a
      where a.id = new.signature_asset_id and a.user_id = new.user_id and a.kind = 'signature'
    ) then
      raise exception 'Assinatura inválida' using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'user_assets' then
    if new.source_asset_id is not null and not exists (
      select 1 from public.user_assets a
      where a.id = new.source_asset_id and a.user_id = new.user_id and a.kind = new.kind
    ) then
      raise exception 'Arquivo de origem inválido' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger professional_profiles_asset_ownership
  before insert or update on public.professional_profiles
  for each row execute function private.check_asset_ownership();

create trigger user_assets_source_ownership
  before insert on public.user_assets
  for each row execute function private.check_asset_ownership();

-- -----------------------------------------------------------------------------
-- RLS
-- Dono ativo:       user_id = (select auth.uid()) and (select private.is_active_user())
-- Suporte (leitura): user_id = (select private.support_target_id())
-- -----------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.user_assets           enable row level security;
alter table public.fields                enable row level security;
alter table public.receipt_templates     enable row level security;
alter table public.receipts              enable row level security;
alter table public.receipt_versions      enable row level security;
alter table public.receipt_counters      enable row level security;
alter table public.support_sessions      enable row level security;
alter table public.audit_logs            enable row level security;

-- profiles: leitura do próprio ou pelo super admin. Escrita só pelo servidor.
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_super_admin()));

-- professional_profiles
create policy professional_profiles_select on public.professional_profiles for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or user_id = (select private.support_target_id())
);
create policy professional_profiles_insert on public.professional_profiles for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_active_user()));
create policy professional_profiles_update on public.professional_profiles for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_user()))
with check (user_id = (select auth.uid()));

-- user_assets (imutáveis: sem update/delete)
create policy user_assets_select on public.user_assets for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or user_id = (select private.support_target_id())
);
create policy user_assets_insert on public.user_assets for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_active_user()));

-- fields (sem delete: arquivar via archived_at)
create policy fields_select on public.fields for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or user_id = (select private.support_target_id())
);
create policy fields_insert on public.fields for insert to authenticated
with check (
  user_id = (select auth.uid()) and (select private.is_active_user()) and is_system = false
);
create policy fields_update on public.fields for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_user()))
with check (user_id = (select auth.uid()));

-- receipt_templates
create policy receipt_templates_select on public.receipt_templates for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or user_id = (select private.support_target_id())
);
create policy receipt_templates_insert on public.receipt_templates for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_active_user()));
create policy receipt_templates_update on public.receipt_templates for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_user()))
with check (user_id = (select auth.uid()));
create policy receipt_templates_delete on public.receipt_templates for delete to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_user()));

-- receipts / receipt_versions: leitura. Escrita apenas pelas RPCs de emissão.
create policy receipts_select on public.receipts for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or user_id = (select private.support_target_id())
);
create policy receipt_versions_select on public.receipt_versions for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or user_id = (select private.support_target_id())
);

-- receipt_counters: nenhuma policy → nenhum acesso direto.

-- support_sessions: o super admin vê as próprias sessões. Escrita via RPC.
create policy support_sessions_select on public.support_sessions for select to authenticated
using (admin_id = (select auth.uid()) and (select private.is_super_admin()));

-- audit_logs: somente super admin lê. Escrita pelo servidor/RPC.
create policy audit_logs_select on public.audit_logs for select to authenticated
using ((select private.is_super_admin()));

-- -----------------------------------------------------------------------------
-- Privilégios de tabela (defesa em profundidade além da RLS)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

revoke insert, update, delete on public.profiles         from authenticated;
revoke insert, update, delete on public.receipts         from authenticated;
revoke insert, update, delete on public.receipt_versions from authenticated;
revoke all                    on public.receipt_counters from authenticated;
revoke insert, update, delete on public.support_sessions from authenticated;
revoke insert, update, delete on public.audit_logs       from authenticated;
revoke delete                 on public.professional_profiles from authenticated;
revoke update, delete         on public.user_assets      from authenticated;
revoke delete                 on public.fields           from authenticated;

revoke all on function private.seed_default_fields(uuid) from public, anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.check_asset_ownership() from public, anon, authenticated;
