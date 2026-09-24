-- =============================================================================
-- MeuRecibo — Excluir recibo
-- O dono exclui um recibo emitido por engano: some o recibo, todas as versões
-- e os PDFs. O número NÃO é reutilizado (o contador por ano só avança), então
-- nenhum número aponta para dois documentos diferentes.
-- =============================================================================

-- Apaga recibo + versões (cascata) numa transação e devolve os caminhos dos
-- PDFs, que o servidor remove do Storage em seguida (os usuários não apagam
-- arquivos diretamente: não há policy de DELETE no Storage).
create function public.delete_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_caller();
  v_receipt public.receipts;
  v_paths text[];
begin
  select * into v_receipt
  from public.receipts r
  where r.id = p_receipt_id and r.user_id = v_uid
  for update;
  if not found then
    raise exception 'Recibo não encontrado' using errcode = 'no_data_found';
  end if;

  select coalesce(array_agg(v.pdf_path order by v.version_no) filter (where v.pdf_path is not null), '{}')
  into v_paths
  from public.receipt_versions v
  where v.receipt_id = v_receipt.id;

  -- current_version_id aponta para uma versão: some junto (FK adiada).
  delete from public.receipts where id = v_receipt.id;

  return jsonb_build_object(
    'number', v_receipt.number,
    'versions', v_receipt.current_version_no,
    'pdf_paths', to_jsonb(v_paths)
  );
end;
$$;

revoke all on function public.delete_receipt(uuid) from public, anon;
grant execute on function public.delete_receipt(uuid) to authenticated;
