-- =============================================================================
-- MeuRecibo — Exclusão definitiva de usuário (LGPD)
-- Excluir a conta (auth.users) já apaga em cascata perfil, modelos, campos,
-- recibos, versões e sessões de suporte, e anonimiza a auditoria. O que NÃO
-- cai em cascata são os arquivos do Storage e os contadores de tentativas:
-- estas funções dão ao servidor (service role) a lista exata para apagar.
-- =============================================================================

-- Todos os arquivos do usuário, em qualquer pasta (<usuário>/...), de todos
-- os buckets. Lê o catálogo do Storage direto: não depende de listar pastas.
create function public.admin_user_storage_objects(p_user_id uuid)
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where split_part(o.name, '/', 1) = p_user_id::text
  order by o.bucket_id, o.name;
$$;

-- Contadores de tentativas ligados ao usuário (chave "<ação>:<usuário>").
create function public.admin_forget_rate_limits(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from private.rate_limits where split_part(key, ':', 2) = p_user_id::text;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_user_storage_objects(uuid) from public, anon, authenticated;
revoke all on function public.admin_forget_rate_limits(uuid) from public, anon, authenticated;
grant execute on function public.admin_user_storage_objects(uuid) to service_role;
grant execute on function public.admin_forget_rate_limits(uuid) to service_role;
