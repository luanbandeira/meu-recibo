-- =============================================================================
-- MeuRecibo — Storage privado
-- Caminho sempre começa pelo dono: <user_id>/...
-- Arquivos são imutáveis para o usuário (sem UPDATE/DELETE).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos',      'logos',      false, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('signatures', 'signatures', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('receipts',   'receipts',   false, 5242880, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy meurecibo_objects_select on storage.objects for select to authenticated
using (
  bucket_id in ('logos', 'signatures', 'receipts')
  and (
    ((storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_active_user()))
    or (storage.foldername(name))[1] = (select private.support_target_id())::text
  )
);

create policy meurecibo_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id in ('logos', 'signatures', 'receipts')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select private.is_active_user())
);
