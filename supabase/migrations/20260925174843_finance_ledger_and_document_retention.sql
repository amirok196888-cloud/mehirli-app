-- Personal finance workspace. Financial rows survive document expiry.
create table public.finance_settings (
 professional_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 business_type text not null default 'unknown' check (business_type in ('unknown','exempt','vat')),
 quota_bytes bigint not null default 104857600 check (quota_bytes > 0),
 retention_accepted_at timestamptz,
 retention_version text
);
create table public.finance_entries (
 id uuid primary key default gen_random_uuid(),
 professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('income','expense')),
 amount numeric(14,2) not null check(amount <> 0 and abs(amount) <= 999999999),
 document_date date,
 paid_on date,
 counterparty text not null default '' check(length(counterparty)<=200),
 document_number text not null default '' check(length(document_number)<=100),
 category text not null default 'other' check(length(category)<=80),
 notes text not null default '' check(length(notes)<=2000),
 job_id uuid references public.pro_jobs(id) on delete set null,
 source text not null default 'manual' check(source in ('manual','job','legacy_job')),
 vat_amount numeric(14,2) not null default 0,
 deductible_vat numeric(14,2) not null default 0,
 vat_period date,
 vat_confirmed boolean not null default false,
 review_required boolean not null default false,
 voided boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(abs(vat_amount)<=abs(amount) and (vat_amount=0 or sign(vat_amount)=sign(amount))),
 check(abs(deductible_vat)<=abs(vat_amount) and (deductible_vat=0 or sign(deductible_vat)=sign(vat_amount))),
 check(kind='expense' or deductible_vat=0),
 check(not vat_confirmed or vat_period is not null)
);
create index finance_entries_owner_date on public.finance_entries(professional_id,paid_on);
create index finance_entries_job on public.finance_entries(job_id);
create unique index finance_invoice_duplicate on public.finance_entries(professional_id,kind,lower(trim(counterparty)),lower(trim(document_number))) where not voided and document_number<>'' and counterparty<>'';
create table public.finance_documents (
 id uuid primary key default gen_random_uuid(),
 professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 entry_id uuid not null references public.finance_entries(id) on delete restrict,
 storage_path text not null unique,
 original_name text not null check(length(original_name)<=200),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
 byte_size bigint not null check(byte_size between 1 and 5242880),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 status text not null default 'pending' check(status in ('pending','stored','expired','failed')),
 uploaded_at timestamptz not null default now(),
 expires_at timestamptz not null,
 deleted_at timestamptz,
 unique(professional_id,sha256)
);
create index finance_docs_owner on public.finance_documents(professional_id);
create index finance_docs_entry on public.finance_documents(entry_id);
create index finance_docs_expiry on public.finance_documents(expires_at) where status='stored';
alter table public.finance_settings enable row level security;
alter table public.finance_entries enable row level security;
alter table public.finance_documents enable row level security;
create policy finance_settings_read on public.finance_settings for select to authenticated using(professional_id=(select auth.uid()));
create policy finance_settings_insert on public.finance_settings for insert to authenticated with check(professional_id=(select auth.uid()) and public.has_my_service_access_v33());
create policy finance_settings_update on public.finance_settings for update to authenticated using(professional_id=(select auth.uid())) with check(professional_id=(select auth.uid()) and public.has_my_service_access_v33());
create policy finance_entries_read on public.finance_entries for select to authenticated using(professional_id=(select auth.uid()));
create policy finance_entries_insert on public.finance_entries for insert to authenticated with check(professional_id=(select auth.uid()) and public.has_my_service_access_v33());
create policy finance_entries_update on public.finance_entries for update to authenticated using(professional_id=(select auth.uid())) with check(professional_id=(select auth.uid()) and public.has_my_service_access_v33());
create policy finance_docs_read on public.finance_documents for select to authenticated using(professional_id=(select auth.uid()));
create policy finance_docs_insert on public.finance_documents for insert to authenticated with check(professional_id=(select auth.uid()) and public.has_my_service_access_v33());
create policy finance_docs_update on public.finance_documents for update to authenticated using(professional_id=(select auth.uid())) with check(professional_id=(select auth.uid()));
revoke all on public.finance_settings,public.finance_entries,public.finance_documents from anon,authenticated;
grant select on public.finance_settings,public.finance_entries,public.finance_documents to authenticated;
grant insert (professional_id,business_type,retention_accepted_at,retention_version), update (business_type,retention_accepted_at,retention_version) on public.finance_settings to authenticated;
grant insert (kind,amount,document_date,paid_on,counterparty,document_number,category,notes,job_id,vat_amount,deductible_vat,vat_period,vat_confirmed), update (kind,amount,document_date,paid_on,counterparty,document_number,category,notes,job_id,vat_amount,deductible_vat,vat_period,vat_confirmed,review_required,voided) on public.finance_entries to authenticated;
grant insert (entry_id,original_name,mime_type,byte_size,sha256),update(status) on public.finance_documents to authenticated;
grant all on public.finance_settings,public.finance_entries,public.finance_documents to service_role;

create or replace function mehirli_private.finance_entry_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.source='manual' and new.kind='income' and new.job_id is not null then raise exception 'Record job income in the job'; end if;
 if new.job_id is not null and not exists(select 1 from public.pro_jobs where id=new.job_id and professional_id=new.professional_id) then raise exception 'Invalid job'; end if;
 if tg_op='UPDATE' and old.source<>'manual' and (new.amount<>old.amount or new.kind<>old.kind or (new.job_id is distinct from old.job_id and pg_trigger_depth()<2) or new.voided<>old.voided) then raise exception 'Edit this payment in the job'; end if;
 if new.review_required=false and new.paid_on is null and new.source<>'manual' then raise exception 'Payment date required'; end if;
 new.updated_at=now(); return new;
end $$;
create trigger finance_entry_guard before insert or update on public.finance_entries for each row execute function mehirli_private.finance_entry_guard();

-- Each change in the cumulative job payment generates only its difference.
-- Historical amounts have no reliable payment date, so require confirmation.
create or replace function mehirli_private.finance_sync_job_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare delta numeric; begin
 delta=coalesce(new.actual_paid,0)-case when tg_op='INSERT' then 0 else coalesce(old.actual_paid,0) end;
 if delta<>0 then
  insert into public.finance_entries(professional_id,kind,amount,paid_on,counterparty,job_id,source,category,notes)
  values(new.professional_id,'income',delta,(now() at time zone 'Asia/Jerusalem')::date,new.customer_name,new.id,'job','work','תשלום מתיק עבודה. יש לבדוק את תאריך התשלום ופרטי המע״מ.');
 end if; return new;
end $$;
revoke all on function mehirli_private.finance_sync_job_payment() from public,anon,authenticated;
create trigger finance_sync_job_payment after insert or update of actual_paid on public.pro_jobs for each row execute function mehirli_private.finance_sync_job_payment();
insert into public.finance_entries(professional_id,kind,amount,counterparty,job_id,source,category,notes,review_required)
select professional_id,'income',actual_paid,customer_name,id,'legacy_job','work','תשלום קיים: יש לאשר תאריך קבלה לפני הכללה בסיכום.',true from public.pro_jobs where coalesce(actual_paid,0)<>0;

create or replace function mehirli_private.finance_document_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare lim bigint; used bigint; begin
 if tg_op='INSERT' then
  if auth.uid() is null or new.professional_id<>auth.uid() then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text,117));
  select quota_bytes into lim from public.finance_settings where professional_id=new.professional_id and retention_version='2026-09-v1' and retention_accepted_at is not null;
  if lim is null then raise exception 'Accept document retention policy first'; end if;
  if not exists(select 1 from public.finance_entries where id=new.entry_id and professional_id=new.professional_id) then raise exception 'Invalid entry'; end if;
  select coalesce(sum(case when status='pending' then 5242880 else byte_size end),0) into used from public.finance_documents where professional_id=new.professional_id and status in ('stored','pending');
  if used+5242880>lim then raise exception 'Storage quota exceeded'; end if;
  new.uploaded_at=now();
  new.expires_at=(date_trunc('month',now() at time zone 'Asia/Jerusalem')+interval '14 months') at time zone 'Asia/Jerusalem';
  new.storage_path=new.professional_id::text||'/'||new.id::text||case new.mime_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' when 'image/webp' then '.webp' else '.jpg' end;
  new.status='pending'; new.deleted_at=null;
 elsif auth.role()<>'service_role' then
  if old.status<>'pending' or new.status<>'stored' then raise exception 'Invalid document transition'; end if;
  if not exists(select 1 from storage.objects where bucket_id='finance-documents' and name=old.storage_path and (metadata->>'size')::bigint=old.byte_size) then raise exception 'Upload not completed'; end if;
 end if; return new;
end $$;
revoke all on function mehirli_private.finance_document_guard() from public,anon,authenticated;
create trigger finance_document_guard before insert or update on public.finance_documents for each row execute function mehirli_private.finance_document_guard();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('finance-documents','finance-documents',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy finance_storage_read on storage.objects for select to authenticated using(bucket_id='finance-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy finance_storage_insert on storage.objects for insert to authenticated with check(bucket_id='finance-documents' and (storage.foldername(name))[1]=(select auth.uid())::text and public.has_my_service_access_v33() and exists(select 1 from public.finance_documents d where d.storage_path=name and d.professional_id=(select auth.uid()) and d.status='pending' and d.uploaded_at>now()-interval '1 day'));

create table mehirli_private.finance_retention_notices(document_id uuid references public.finance_documents(id) on delete cascade,days_before integer,primary key(document_id,days_before));
create or replace function public.finance_retention_notify() returns integer language plpgsql security definer set search_path='' as $$
declare n integer; begin
 with due as (
  select d.id,d.professional_id,d.original_name,d.expires_at,t.days from public.finance_documents d cross join (values(60),(30),(7)) t(days)
  where d.status='stored' and d.expires_at>now() and d.expires_at<=now()+make_interval(days=>t.days)
 ), fresh as (
  insert into mehirli_private.finance_retention_notices select id,days from due on conflict do nothing returning document_id,days_before
 ) insert into public.notifications(user_id,kind,title,body,data)
 select d.professional_id,'finance_retention','מסמך מתקרב למועד המחיקה',
 'המסמך '||d.original_name||' יימחק בתום '||to_char((d.expires_at at time zone 'Asia/Jerusalem')::date-1,'DD/MM/YYYY')||'. יש לייצא ולשמור עותק לפני המחיקה.',jsonb_build_object('document_id',d.id)
 from due d join fresh f on f.document_id=d.id and f.days_before=d.days;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.finance_retention_notify() from public,anon,authenticated;
grant execute on function public.finance_retention_notify() to service_role;
-- Secret never leaves Vault except in the cron request header. The verifier is service-role only.
do $$ begin perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'mehirli_finance_cron'); end $$;
create or replace function public.finance_cron_authorized(p_token text) returns boolean language sql security definer set search_path='' as $$
 select length(coalesce(p_token,''))=64 and exists(select 1 from vault.decrypted_secrets where name='mehirli_finance_cron' and decrypted_secret=p_token);
$$;
revoke all on function public.finance_cron_authorized(text) from public,anon,authenticated;
grant execute on function public.finance_cron_authorized(text) to service_role;
