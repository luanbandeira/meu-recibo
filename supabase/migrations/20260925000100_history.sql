-- =============================================================================
-- MeuRecibo — Fase 8: histórico (busca, filtros, ordenação e totais)
-- =============================================================================

-- Data do recibo, a mesma exibida no histórico: a do atendimento quando houver,
-- senão o dia da emissão no horário de Brasília. Base do filtro por período.
alter table public.receipts
  add column receipt_date date generated always as (
    coalesce(service_date, (issued_at at time zone 'America/Sao_Paulo')::date)
  ) stored;

create index receipts_user_date_idx on public.receipts (user_id, receipt_date desc);

-- -----------------------------------------------------------------------------
-- list_receipts — uma página do histórico + total e soma dos valores filtrados.
-- SECURITY INVOKER: a RLS de receipts vale normalmente (próprio usuário ou
-- modo suporte); p_user_id é filtro adicional, nunca concede acesso.
-- p_terms: palavras já normalizadas pela aplicação (minúsculas, sem acento).
-- Cada palavra precisa aparecer no texto pesquisável ou no número do recibo;
-- palavras só com dígitos e pontuação (CPF, CNPJ, número) casam também sem a
-- pontuação. Curingas digitados (% e _) são literais.
-- -----------------------------------------------------------------------------
create function public.list_receipts(
  p_user_id uuid,
  p_terms text[] default '{}',
  p_from date default null,
  p_to date default null,
  p_template_id uuid default null,
  p_sort text default 'recentes',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with terms as (
    select
      replace(replace(replace(lower(t), '\', '\\'), '%', '\%'), '_', '\_') as pattern,
      case when t ~ '^[0-9./-]+$' then nullif(regexp_replace(t, '[^0-9]', '', 'g'), '') end as digits
    from unnest(coalesce(p_terms, '{}')) with ordinality as u(t, n)
    where trim(t) <> '' and n <= 8
  ),
  filtered as (
    select r.*
    from public.receipts r
    where r.user_id = p_user_id
      and (p_from is null or r.receipt_date >= p_from)
      and (p_to is null or r.receipt_date <= p_to)
      and (p_template_id is null or r.template_id = p_template_id)
      and not exists (
        select 1 from terms
        where not (
          (r.search_text || ' ' || lower(r.number)) like '%' || terms.pattern || '%'
          or (terms.digits is not null
              and regexp_replace(r.search_text || ' ' || r.number, '[^0-9]', '', 'g') like '%' || terms.digits || '%')
        )
      )
  ),
  page as (
    select f.*, row_number() over (
      order by
        case when p_sort = 'valor' then f.amount_cents end desc nulls last,
        case when p_sort = 'pagador' then lower(f.payer_name) end asc nulls last,
        case when p_sort = 'data' then f.receipt_date end desc,
        case when p_sort = 'antigos' then f.issued_at end asc,
        f.issued_at desc,
        f.id
    ) as ord
    from filtered f
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'total_amount_cents', (select coalesce(sum(amount_cents), 0) from filtered where status = 'issued'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'number', p.number,
        'status', p.status,
        'template_id', p.template_id,
        'template_name', p.template_name,
        'payer_name', p.payer_name,
        'amount_cents', p.amount_cents,
        'service_date', p.service_date,
        'receipt_date', p.receipt_date,
        'issued_at', p.issued_at,
        'current_version_no', p.current_version_no
      ) order by p.ord)
      from page p
      where p.ord > greatest(p_offset, 0)
        and p.ord <= greatest(p_offset, 0) + least(greatest(p_limit, 1), 100)
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.list_receipts(uuid, text[], date, date, uuid, text, integer, integer) from public, anon;
grant execute on function public.list_receipts(uuid, text[], date, date, uuid, text, integer, integer) to authenticated;
