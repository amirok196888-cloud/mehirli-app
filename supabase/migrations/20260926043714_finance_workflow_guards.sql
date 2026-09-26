create or replace function mehirli_private.finance_entry_guard() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text,118));
 if tg_op='UPDATE' and pg_trigger_depth()>1 and old.job_id is not null and new.job_id is null and (to_jsonb(new)-'job_id'-'updated_at')=(to_jsonb(old)-'job_id'-'updated_at') then return new; end if;
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


create or replace function mehirli_private.finance_sync_job_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare delta numeric; assigned date:=date_trunc('month',now() at time zone 'Asia/Jerusalem')::date; next_month date;
begin
 delta=coalesce(new.actual_paid,0)-case when tg_op='INSERT' then 0 else coalesce(old.actual_paid,0) end;
 if delta<>0 then
  perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text,118));
  loop
   select end_month into next_month from public.finance_closures where professional_id=new.professional_id and assigned>=start_month and assigned<end_month limit 1;
   exit when next_month is null; assigned=next_month;
  end loop;
  insert into public.finance_entries(professional_id,kind,amount,paid_on,counterparty,job_id,source,category,notes,report_month,review_required)
  values(new.professional_id,'income',delta,(now() at time zone 'Asia/Jerusalem')::date,new.customer_name,new.id,'job','work','תשלום מתיק עבודה — ממתין לצירוף מסמך ולאישור.',assigned,true);
 end if;return new;
end $$;
