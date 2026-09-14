-- V36 — private PDF quotes stored inside Mehirli
alter table public.pro_jobs
  add column if not exists quote_pdf_path text,
  add column if not exists quote_pdf_generated_at timestamptz;

comment on column public.pro_jobs.quote_pdf_path is
  'Private Supabase Storage path for the PDF snapshot sent to the customer.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-pdfs', 'quote-pdfs', false, 5242880, array['application/pdf']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists quote_pdfs_storage_select_own on storage.objects;
create policy quote_pdfs_storage_select_own
on storage.objects for select
to authenticated
using (
  bucket_id = 'quote-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists quote_pdfs_storage_insert_own on storage.objects;
create policy quote_pdfs_storage_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'quote-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_my_service_access_v33()
);

drop policy if exists quote_pdfs_storage_update_own on storage.objects;
create policy quote_pdfs_storage_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'quote-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_my_service_access_v33()
)
with check (
  bucket_id = 'quote-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_my_service_access_v33()
);

drop policy if exists quote_pdfs_storage_delete_own on storage.objects;
create policy quote_pdfs_storage_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'quote-pdfs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_my_service_access_v33()
);

-- Introductory launch price, VAT included in the customer-facing offer.
update public.platform_billing_settings
set monthly_price = 49,
    updated_at = now()
where singleton = true;
