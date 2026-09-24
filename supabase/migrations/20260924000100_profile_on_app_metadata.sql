-- =============================================================================
-- O Supabase Auth (Admin API createUser) insere o usuário e só DEPOIS grava o
-- app_metadata, na mesma transação. Por isso o perfil é criado quando o
-- username aparece — no INSERT ou no UPDATE de raw_app_meta_data.
-- Usuário sem username (ex.: criado pelo dashboard) não recebe perfil e,
-- portanto, não tem acesso a nada no app nem passa pela RLS.
-- =============================================================================

create or replace function private.handle_new_auth_user()
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
    return new;
  end if;
  if exists (select 1 from public.profiles p where p.id = new.id) then
    return new;
  end if;

  insert into public.profiles (id, username, display_name, role, created_by)
  values (new.id, v_username, coalesce(v_display_name, v_username), v_role, v_created_by);

  if v_role = 'user' then
    perform private.seed_default_fields(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function private.handle_new_auth_user();

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
