-- =============================================================================
-- MeuRecibo — Fase 2: administração de usuários
-- Consultas administrativas via RPC security definer (precisam de auth.users
-- para "último acesso"), sempre verificando super admin no início.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- Busca sem acento e sem diferenciar maiúsculas; curingas do usuário escapados.
create function private.search_pattern(p_search text)
returns text
language sql
stable
set search_path = ''
as $$
  select '%' || lower(extensions.unaccent(
    replace(replace(replace(trim(p_search), '\', '\\'), '%', '\%'), '_', '\_')
  )) || '%';
$$;

create function private.assert_super_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'Acesso negado' using errcode = 'insufficient_privilege';
  end if;
  return auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- Lista de usuários (somente papel "user"), com busca, filtro e paginação
-- -----------------------------------------------------------------------------
create function public.admin_list_users(
  p_search text default null,
  p_status public.account_status default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  full_name text,
  status public.account_status,
  must_change_password boolean,
  onboarding_completed boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pattern text := case when nullif(trim(p_search), '') is null then null
                         else private.search_pattern(p_search) end;
begin
  perform private.assert_super_admin();

  return query
  select
    p.id, p.username::text, p.display_name, pp.full_name, p.status,
    p.must_change_password, pp.onboarding_completed_at is not null,
    p.created_at, u.last_sign_in_at,
    count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.professional_profiles pp on pp.user_id = p.id
  where p.role = 'user'
    and (p_status is null or p.status = p_status)
    and (
      v_pattern is null
      or lower(extensions.unaccent(p.username::text)) like v_pattern
      or lower(extensions.unaccent(p.display_name)) like v_pattern
      or lower(extensions.unaccent(coalesce(pp.full_name, ''))) like v_pattern
    )
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

create function public.admin_get_user(p_user_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  full_name text,
  status public.account_status,
  must_change_password boolean,
  onboarding_completed boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  created_by_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_super_admin();

  return query
  select
    p.id, p.username::text, p.display_name, pp.full_name, p.status,
    p.must_change_password, pp.onboarding_completed_at is not null,
    p.created_at, u.last_sign_in_at, creator.display_name
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.professional_profiles pp on pp.user_id = p.id
  left join public.profiles creator on creator.id = p.created_by
  where p.id = p_user_id and p.role = 'user';
end;
$$;

create function public.admin_user_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_super_admin();

  return (
    select jsonb_build_object(
      'total', count(*),
      'active', count(*) filter (where p.status = 'active'),
      'disabled', count(*) filter (where p.status = 'disabled'),
      'pending_first_access', count(*) filter (where p.must_change_password and p.status = 'active')
    )
    from public.profiles p
    where p.role = 'user'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Revogação de sessões (redefinir acesso / desativar). Apagar a sessão invalida
-- o refresh token e faz o Auth recusar o access token dessa sessão.
-- Somente o servidor (service role) executa, após autorizar o super admin.
-- -----------------------------------------------------------------------------
create function public.admin_revoke_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke all on function private.search_pattern(text) from public, anon, authenticated;
revoke all on function private.assert_super_admin() from public, anon, authenticated;

revoke all on function public.admin_list_users(text, public.account_status, integer, integer) from public, anon;
revoke all on function public.admin_get_user(uuid) from public, anon;
revoke all on function public.admin_user_stats() from public, anon;
grant execute on function public.admin_list_users(text, public.account_status, integer, integer) to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;
grant execute on function public.admin_user_stats() to authenticated;

revoke all on function public.admin_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_sessions(uuid) to service_role;
