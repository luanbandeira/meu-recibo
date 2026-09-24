-- =============================================================================
-- MeuRecibo — Fase 10: limites de tentativas (rate limit)
-- Na Vercel cada requisição pode cair numa instância diferente: contador em
-- memória não vale. O contador fica no banco, uma linha por chave (ação +
-- usuário), em janela fixa. Só o servidor (service role) usa — nenhum usuário
-- lê, zera ou consome o limite de outro.
-- =============================================================================

create table private.rate_limits (
  key text primary key check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits integer not null
);

-- Registra uma tentativa e diz se ainda está dentro do limite.
create function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  if p_key is null or p_max < 1 or p_window_seconds < 1 then
    raise exception 'Parâmetros inválidos' using errcode = 'invalid_parameter_value';
  end if;

  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start <= now() - make_interval(secs => p_window_seconds)
                        then now() else r.window_start end,
    hits = case when r.window_start <= now() - make_interval(secs => p_window_seconds)
                then 1 else r.hits + 1 end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke all on table private.rate_limits from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
