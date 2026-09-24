-- Stubs mínimos do ambiente Supabase (auth, storage, papéis e privilégios padrão)
-- para aplicar as migrations num Postgres embutido (PGlite) durante os testes.
-- A verificação definitiva continua sendo tests/integration contra o projeto real.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create schema storage;
create schema extensions;
grant usage on schema public, auth, storage, extensions to anon, authenticated;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb default '{}',
  last_sign_in_at timestamptz
);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users (id) on delete cascade);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid
);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;

create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to authenticated;

-- Privilégios padrão que o Supabase concede em objetos novos do schema public.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
