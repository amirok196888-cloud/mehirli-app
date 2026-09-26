-- Document-first workflow. Originals remain private; closing freezes a reproducible snapshot.
alter table public.finance_settings add column advance_rate numeric(5,2) check(advance_rate between 0 and 100), add column reporting_months integer not null default 1 check(reporting_months in (1,2));
grant insert(advance_rate,reporting_months),update(advance_rate,reporting_months) on public.finance_settings to authenticated;
alter table public.finance_entries alter column amount drop not null, alter column review_required set default true;
alter table public.finance_entries add column approved_at timestamptz, add column report_month date not null default date_trunc('month',now() at time zone 'Asia/Jerusalem')::date, add column withholding numeric(14,2) not null default 0, add column correction_of uuid references public.finance_entries(id), add column deletion_pending boolean not null default false;
update public.finance_entries set report_month=date_trunc('month',coalesce(document_date,paid_on,created_at::date))::date,review_required=true;
alter table public.finance_entries add constraint finance_withholding_valid check(abs(withholding)<=abs(coalesce(amount,0)) and (withholding=0 or sign(withholding)=sign(amount)) and (kind='income' or withholding=0));
alter table public.finance_entries add constraint finance_report_month_valid check(extract(day from report_month)=1);
create index finance_entries_correction on public.finance_entries(correction_of);
grant insert(report_month,withholding,correction_of,review_required),update(report_month,withholding,correction_of) on public.finance_entries to authenticated;
create table public.finance_closures(id uuid primary key default gen_random_uuid(), professional_id uuid not null references auth.users(id), start_month date not null, end_month date not null, created_at timestamptz not null default now(), snapshot jsonb not null, unique(professional_id,start_month));
alter table public.finance_closures enable row level security;
create policy finance_closures_read on public.finance_closures for select to authenticated using(professional_id=(select auth.uid()));
revoke all on public.finance_closures from anon,authenticated;
grant select on public.finance_closures to authenticated;
grant all on public.finance_closures to service_role;

create or replace function mehirli_private.finance_entry_guard() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text,118));
 if tg_op='UPDATE' and old.deletion_pending and current_user<>'service_role' and current_user<>'postgres' then raise exception 'Deletion in progress'; end if;
 if exists(select 1 from public.finance_closures c where c.professional_id=new.professional_id and ((new.report_month>=c.start_month and new.report_month<c.end_month) or (tg_op='UPDATE' and old.report_month>=c.start_month and old.report_month<c.end_month))) then raise exception 'Period closed'; end if;
 if tg_op='UPDATE' and old.kind='income' and (new.kind<>old.kind or new.voided<>old.voided) then raise exception 'Use linked credit document'; end if;
 if new.source='manual' and new.kind='income' and new.job_id is not null then raise exception 'Record job income in the job'; end if;
 if new.job_id is not null and not exists(select 1 from public.pro_jobs where id=new.job_id and professional_id=new.professional_id) then raise exception 'Invalid job'; end if;
 if tg_op='UPDATE' and old.source<>'manual' and (new.amount is distinct from old.amount or new.kind<>old.kind or (new.job_id is distinct from old.job_id and pg_trigger_depth()<2) or new.voided<>old.voided) then raise exception 'Edit this payment in the job'; end if;
 if tg_op='UPDATE' and old.kind='income' and old.approved_at is not null and (new.amount is distinct from old.amount or new.kind<>old.kind or new.voided<>old.voided or new.document_number<>old.document_number or new.counterparty<>old.counterparty or new.vat_amount<>old.vat_amount or new.correction_of is distinct from old.correction_of) then raise exception 'Use linked credit document'; end if;
 if new.correction_of is not null and not exists(select 1 from public.finance_entries e where e.id=new.correction_of and e.professional_id=new.professional_id and e.kind=new.kind and e.id<>new.id) then raise exception 'Invalid correction link'; end if;
 if new.kind='income' and new.amount<0 and new.correction_of is null and new.source='manual' then raise exception 'Credit requires original entry'; end if;
 if not new.review_required and not new.voided then
  if new.amount is null or new.document_date is null or new.counterparty='' then raise exception 'Complete document details'; end if;
  if not exists(select 1 from public.finance_documents d where d.entry_id=new.id and d.professional_id=new.professional_id and d.status in ('stored','expired')) then raise exception 'Document required'; end if;
  new.approved_at=coalesce(new.approved_at,now());
 end if;
 new.updated_at=clock_timestamp();return new;
end $$;

-- Serialize document attachment with closing. Expiry cleanup remains allowed.
create or replace function mehirli_private.finance_document_period_guard() returns trigger language plpgsql set search_path='' as $$
declare e public.finance_entries;begin
 select * into e from public.finance_entries where id=new.entry_id;
 perform pg_advisory_xact_lock(hashtextextended(e.professional_id::text,118));
 if tg_op='INSERT' or (old.status='pending' and new.status='stored') then
  if e.deletion_pending or exists(select 1 from public.finance_closures c where c.professional_id=e.professional_id and e.report_month>=c.start_month and e.report_month<c.end_month) then raise exception 'Period closed or deletion in progress'; end if;
 end if;return new;
end $$;
create trigger finance_document_period_guard before insert or update on public.finance_documents for each row execute function mehirli_private.finance_document_period_guard();

create or replace function public.finance_close_period(p_month date) returns public.finance_closures language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); last_month date; st public.finance_settings; result public.finance_closures; snap jsonb;
begin
 if uid is null or not public.has_my_service_access_v33() then raise exception 'Not authorized'; end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Invalid month'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,118));
 select * into st from public.finance_settings where professional_id=uid;
 last_month=(p_month+make_interval(months=>coalesce(st.reporting_months,1)))::date;
 if exists(select 1 from public.finance_closures where professional_id=uid and start_month<last_month and end_month>p_month) then raise exception 'Period already closed'; end if;
 if exists(select 1 from public.finance_entries where professional_id=uid and report_month>=p_month and report_month<last_month and not voided and (review_required or approved_at is null)) then raise exception 'Review pending documents first'; end if;
 if not exists(select 1 from public.finance_entries where professional_id=uid and report_month>=p_month and report_month<last_month and not voided) then raise exception 'No approved documents'; end if;
 if exists(select 1 from public.finance_documents d join public.finance_entries e on e.id=d.entry_id where e.professional_id=uid and e.report_month>=p_month and e.report_month<last_month and not e.voided and d.status='pending') then raise exception 'Uploads pending'; end if;
 select jsonb_build_object('settings',to_jsonb(st),'entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.finance_entries e where e.professional_id=uid and e.report_month>=p_month and e.report_month<last_month and not e.voided),'[]'::jsonb),'documents',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.finance_documents d join public.finance_entries e on e.id=d.entry_id where e.professional_id=uid and e.report_month>=p_month and e.report_month<last_month and not e.voided),'[]'::jsonb)) into snap;
 insert into public.finance_closures(professional_id,start_month,end_month,snapshot) values(uid,p_month,last_month,snap) returning * into result;
 return result;
end $$;
revoke all on function public.finance_close_period(date) from public,anon;
grant execute on function public.finance_close_period(date) to authenticated;

-- Request physical deletion of an open expense. Income is never deleted.
create or replace function public.finance_request_expense_delete(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); e public.finance_entries;begin
 if uid is null or not public.has_my_service_access_v33() then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,118));
 select * into e from public.finance_entries where id=p_id and professional_id=uid for update;
 if e.id is null or e.kind<>'expense' or e.source<>'manual' then raise exception 'Only own open expense can be deleted'; end if;
 if exists(select 1 from public.finance_closures c where c.professional_id=uid and e.report_month>=c.start_month and e.report_month<c.end_month) then raise exception 'Period closed'; end if;
 update public.finance_entries set voided=true,deletion_pending=true where id=p_id;
 return jsonb_build_object('id',p_id,'documents',coalesce((select jsonb_agg(jsonb_build_object('id',id,'path',storage_path)) from public.finance_documents where entry_id=p_id),'[]'::jsonb));
end $$;
revoke all on function public.finance_request_expense_delete(uuid) from public,anon;
grant execute on function public.finance_request_expense_delete(uuid) to authenticated;
create or replace function public.finance_finish_expense_delete(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.finance_entries where id=p_id and kind='expense' and deletion_pending) then raise exception 'No deletion request'; end if;
 if exists(select 1 from storage.objects o join public.finance_documents d on d.storage_path=o.name and o.bucket_id='finance-documents' where d.entry_id=p_id) then raise exception 'Physical documents still exist'; end if;
 delete from public.finance_documents where entry_id=p_id;
 delete from public.finance_entries where id=p_id and deletion_pending;
end $$;
revoke all on function public.finance_finish_expense_delete(uuid) from public,anon,authenticated;
grant execute on function public.finance_finish_expense_delete(uuid) to service_role;
-- Prevent an in-flight upload creating an orphan after an expense deletion request.
create or replace function mehirli_private.finance_storage_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid;begin
 if new.bucket_id<>'finance-documents' then return new; end if;
 select professional_id into uid from public.finance_documents where storage_path=new.name;
 if uid is null then raise exception 'Missing upload reservation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,118));
 if not exists(select 1 from public.finance_documents d join public.finance_entries e on e.id=d.entry_id where d.storage_path=new.name and d.status='pending' and not e.deletion_pending) then raise exception 'Upload cancelled'; end if;
 return new;
end $$;
revoke all on function mehirli_private.finance_storage_guard() from public,anon,authenticated;
create trigger finance_storage_guard before insert on storage.objects for each row execute function mehirli_private.finance_storage_guard();
