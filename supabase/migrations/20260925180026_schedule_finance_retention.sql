alter table public.finance_documents drop constraint finance_documents_professional_id_sha256_key;
create unique index finance_document_active_hash on public.finance_documents(professional_id,sha256) where status in ('pending','stored');
drop policy finance_storage_read on storage.objects;
create policy finance_storage_read on storage.objects for select to authenticated using(bucket_id='finance-documents' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.finance_documents d where d.storage_path=name and d.professional_id=(select auth.uid()) and d.status='stored' and d.expires_at>now()));
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('mehirli-finance-retention','*/15 * * * *', $cron$
 select net.http_post(
  url:='https://jgnbcrlvsudfqfofmvlx.supabase.co/functions/v1/mehirli-finance-retention',
  headers:=jsonb_build_object('Content-Type','application/json','x-finance-cron',(select decrypted_secret from vault.decrypted_secrets where name='mehirli_finance_cron')),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$cron$);
