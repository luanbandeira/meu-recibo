-- =============================================================================
-- MeuRecibo — Fundação: extensões, tipos, tabelas, funções auxiliares
-- Ver docs/ARQUITETURA.md §7 (modelo de dados) e §8 (RLS).
-- =============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('user', 'super_admin');
create type public.account_status as enum ('active', 'disabled');
create type public.document_type as enum ('cpf', 'cnpj');
create type public.asset_kind as enum ('logo', 'signature');
create type public.asset_variant as enum ('original', 'processed');
create type public.field_type as enum (
  'short_text', 'long_text', 'currency', 'number', 'date', 'document', 'phone'
);
create type public.template_status as enum ('active', 'archived');
create type public.receipt_status as enum ('issued', 'cancelled');

-- -----------------------------------------------------------------------------
-- Utilitário: updated_at
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — 1:1 com auth.users. Papel e status NUNCA são alterados pelo usuário.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique
    check (username::text ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  display_name text not null check (char_length(display_name) between 1 and 120),
  role public.user_role not null default 'user',
  status public.account_status not null default 'active',
  must_change_password boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Funções de autorização usadas nas policies (security definer para ler
-- profiles/support_sessions sem depender das próprias policies).
-- Nas policies, sempre chamadas como (select private.fn()) → avaliadas 1x/query.
-- -----------------------------------------------------------------------------
create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

create function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin' and p.status = 'active'
  );
$$;

-- -----------------------------------------------------------------------------
-- professional_profiles — identidade profissional usada nos recibos
-- -----------------------------------------------------------------------------
create table public.professional_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 160),
  company_name text check (char_length(company_name) <= 160),
  profession text check (char_length(profession) <= 120),
  council text check (char_length(council) <= 40),
  registration_number text check (char_length(registration_number) <= 40),
  document_type public.document_type,
  document_number text,
  phone text check (phone ~ '^[0-9]{10,11}$'),
  city text check (char_length(city) <= 80),
  state text check (state in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  )),
  timezone text not null default 'America/Sao_Paulo' check (timezone in (
    'America/Noronha','America/Belem','America/Fortaleza','America/Recife',
    'America/Araguaina','America/Maceio','America/Bahia','America/Sao_Paulo',
    'America/Campo_Grande','America/Cuiaba','America/Santarem','America/Porto_Velho',
    'America/Boa_Vista','America/Manaus','America/Eirunepe','America/Rio_Branco'
  )),
  logo_asset_id uuid,
  signature_asset_id uuid,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_number_format check (
    document_number is null
    or (document_type = 'cpf' and document_number ~ '^[0-9]{11}$')
    or (document_type = 'cnpj' and document_number ~ '^[0-9]{14}$')
  )
);

create trigger professional_profiles_updated_at before update on public.professional_profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_assets — logo e assinatura. Imutáveis: novo upload = nova linha/caminho.
-- -----------------------------------------------------------------------------
create table public.user_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.asset_kind not null,
  variant public.asset_variant not null,
  source_asset_id uuid references public.user_assets (id) on delete no action,
  bucket text not null check (bucket in ('logos', 'signatures')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  width integer not null check (width between 1 and 8000),
  height integer not null check (height between 1 and 8000),
  processing jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint storage_path_owner check (split_part(storage_path, '/', 1) = user_id::text),
  constraint processed_has_source check (variant = 'original' or source_asset_id is not null)
);

create index user_assets_user_idx on public.user_assets (user_id, kind, created_at desc);

alter table public.professional_profiles
  add constraint professional_profiles_logo_fk
    foreign key (logo_asset_id) references public.user_assets (id) on delete no action,
  add constraint professional_profiles_signature_fk
    foreign key (signature_asset_id) references public.user_assets (id) on delete no action;

-- -----------------------------------------------------------------------------
-- fields — campos de emissão (padrão semeados + personalizados), por usuário
-- -----------------------------------------------------------------------------
create table public.fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null check (
    key ~ '^[a-z][a-z0-9_]{1,39}$'
    and key not in ('numero_recibo', 'valor_extenso', 'logo', 'assinatura')
    and key !~ '^profissional_'
  ),
  label text not null check (char_length(label) between 1 and 80),
  type public.field_type not null,
  required boolean not null default false,
  default_value text check (char_length(default_value) <= 2000),
  is_system boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create index fields_user_idx on public.fields (user_id, sort_order);

create trigger fields_updated_at before update on public.fields
  for each row execute function private.set_updated_at();

-- A chave é o nome da variável nos modelos: não pode mudar depois de criada.
create function private.fields_guard_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.key is distinct from old.key
     or new.is_system is distinct from old.is_system
     or new.type is distinct from old.type then
    raise exception 'Campos key, type e is_system não podem ser alterados'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger fields_guard_immutable before update on public.fields
  for each row execute function private.fields_guard_immutable();

-- -----------------------------------------------------------------------------
-- receipt_templates — modelos (conteúdo TipTap em JSON validado no servidor)
-- -----------------------------------------------------------------------------
create table public.receipt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  content jsonb not null check (pg_column_size(content) <= 524288),
  settings jsonb not null default '{}'::jsonb check (pg_column_size(settings) <= 8192),
  used_variables text[] not null default '{}',
  status public.template_status not null default 'active',
  is_default boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index receipt_templates_user_idx on public.receipt_templates (user_id, status, updated_at desc);

create trigger receipt_templates_updated_at before update on public.receipt_templates
  for each row execute function private.set_updated_at();

-- revision incrementa sozinha: o autosave faz UPDATE ... WHERE revision = <esperada>
-- e, se 0 linhas forem afetadas, houve edição concorrente (outra aba/aparelho).
create function private.bump_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;

create trigger receipt_templates_bump_revision before update on public.receipt_templates
  for each row execute function private.bump_revision();

-- -----------------------------------------------------------------------------
-- receipts — recibo lógico (o que aparece no histórico)
-- -----------------------------------------------------------------------------
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid references public.receipt_templates (id) on delete set null,
  number text not null,
  year integer not null,
  sequence integer not null check (sequence > 0),
  current_version_id uuid,
  current_version_no integer not null default 1,
  status public.receipt_status not null default 'issued',
  template_name text not null,
  payer_name text check (char_length(payer_name) <= 200),
  amount_cents bigint check (amount_cents >= 0),
  service_date date,
  search_text text not null default '' check (char_length(search_text) <= 4000),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number),
  unique (user_id, year, sequence)
);

create index receipts_user_issued_idx on public.receipts (user_id, issued_at desc);
create index receipts_user_template_idx on public.receipts (user_id, template_id);
create index receipts_search_idx on public.receipts using gin (search_text extensions.gin_trgm_ops);

create trigger receipts_updated_at before update on public.receipts
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- receipt_versions — imutáveis; snapshots tornam cada versão autossuficiente
-- -----------------------------------------------------------------------------
create table public.receipt_versions (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  version_no integer not null check (version_no > 0),
  template_snapshot jsonb not null,
  profile_snapshot jsonb not null,
  "values" jsonb not null check (pg_column_size("values") <= 65536),
  idempotency_key uuid not null,
  pdf_path text,
  pdf_sha256 text check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  file_name text check (file_name ~ '^[a-z0-9-]{1,80}\.pdf$'),
  correction_note text check (char_length(correction_note) <= 500),
  created_at timestamptz not null default now(),
  unique (receipt_id, version_no),
  unique (user_id, idempotency_key)
);

create index receipt_versions_receipt_idx on public.receipt_versions (receipt_id, version_no desc);

alter table public.receipts
  add constraint receipts_current_version_fk
    foreign key (current_version_id) references public.receipt_versions (id)
    deferrable initially deferred;

-- -----------------------------------------------------------------------------
-- receipt_counters — numeração por usuário/ano. Sem acesso direto (sem policies).
-- -----------------------------------------------------------------------------
create table public.receipt_counters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null,
  last_value integer not null default 0,
  primary key (user_id, year)
);

-- -----------------------------------------------------------------------------
-- support_sessions — modo suporte administrativo (somente leitura)
-- -----------------------------------------------------------------------------
create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 300),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  ended_at timestamptz,
  check (admin_id <> target_user_id)
);

-- no máximo uma sessão aberta por admin
create unique index support_sessions_one_open_idx
  on public.support_sessions (admin_id) where ended_at is null;

-- Alvo da sessão de suporte ativa do admin atual (null se não houver).
create function private.support_target_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.target_user_id
  from public.support_sessions s
  join public.profiles p on p.id = s.admin_id
  where s.admin_id = auth.uid()
    and s.ended_at is null
    and s.expires_at > now()
    and p.role = 'super_admin'
    and p.status = 'active'
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- audit_logs — append-only. Nunca gravar senha, CPF ou dados de paciente.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_user_id uuid references public.profiles (id) on delete set null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 4096),
  ip_hash text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_user_id, created_at desc);

create function private.audit_logs_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Única alteração permitida: anular referências quando um usuário é excluído
  -- (on delete set null), mantendo o registro do que aconteceu.
  if tg_op = 'UPDATE'
     and (new.actor_id is null or new.actor_id = old.actor_id)
     and (new.target_user_id is null or new.target_user_id = old.target_user_id)
     and new.action = old.action
     and new.entity_type is not distinct from old.entity_type
     and new.entity_id is not distinct from old.entity_id
     and new.metadata = old.metadata
     and new.ip_hash is not distinct from old.ip_hash
     and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'audit_logs é somente inserção' using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.audit_logs_append_only();

-- -----------------------------------------------------------------------------
-- Permissões das funções auxiliares
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.support_target_id() to authenticated;
