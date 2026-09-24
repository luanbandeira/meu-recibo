-- =============================================================================
-- MeuRecibo — Fase 9: modo suporte e tela de auditoria
-- =============================================================================

-- Qualquer super admin lê TODAS as sessões de suporte (auditoria: quem acessou
-- quem, quando e por quê). Continua sem escrita direta — só pelas RPCs.
drop policy support_sessions_select on public.support_sessions;
create policy support_sessions_select on public.support_sessions for select to authenticated
using ((select private.is_super_admin()));

-- -----------------------------------------------------------------------------
-- admin_list_audit — registros com filtros e paginação, já com os nomes de
-- quem fez e de quem foi afetado, e o motivo das sessões de suporte.
-- -----------------------------------------------------------------------------
create function public.admin_list_audit(
  p_action_prefix text default null,
  p_target_user_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id bigint,
  action text,
  created_at timestamptz,
  actor_name text,
  target_user_id uuid,
  target_name text,
  target_username text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  support_reason text,
  total_count bigint
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
    a.id, a.action, a.created_at,
    actor.display_name,
    a.target_user_id,
    coalesce(tpp.full_name, target.display_name),
    target.username::text,
    a.entity_type, a.entity_id, a.metadata,
    s.reason,
    count(*) over ()
  from public.audit_logs a
  left join public.profiles actor on actor.id = a.actor_id
  left join public.profiles target on target.id = a.target_user_id
  left join public.professional_profiles tpp on tpp.user_id = a.target_user_id
  left join public.support_sessions s
    on a.entity_type = 'support_session' and s.id = a.entity_id
  where (p_action_prefix is null or a.action = p_action_prefix or a.action like p_action_prefix || '.%')
    and (p_target_user_id is null or a.target_user_id = p_target_user_id)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at < p_to)
  order by a.created_at desc, a.id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.admin_list_audit(text, uuid, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.admin_list_audit(text, uuid, timestamptz, timestamptz, integer, integer) to authenticated;
