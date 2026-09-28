-- Append-only job adjustments. Original accepted quote remains unchanged.
alter table public.pro_jobs add column if not exists addition_total numeric(14,2) not null default 0 check(addition_total>=0);
alter table public.pro_jobs add column if not exists adjustment_discount_total numeric(14,2) not null default 0 check(adjustment_discount_total>=0);
create table public.pro_job_ledger (
 id uuid primary key,
 professional_id uuid not null references auth.users(id),
 job_id uuid not null references public.pro_jobs(id) on delete cascade,
 kind text not null check(kind in ('addition','discount','payment')),
 amount numeric(14,2) not null check(amount>0 and amount<=999999999),
 description text not null default '' check(length(description)<=500),
 created_at timestamptz not null default now()
);
alter table public.pro_job_ledger enable row level security;
revoke all on public.pro_job_ledger from anon,authenticated;
grant select,insert on public.pro_job_ledger to authenticated;
create policy job_ledger_read on public.pro_job_ledger for select to authenticated using(professional_id=(select auth.uid()));
create policy job_ledger_insert on public.pro_job_ledger for insert to authenticated with check(professional_id=(select auth.uid()) and public.has_my_service_access_v33() and exists(select 1 from public.pro_jobs j where j.id=job_id and j.professional_id=(select auth.uid())));
create index pro_job_ledger_job on public.pro_job_ledger(job_id,created_at);
create or replace function mehirli_private.apply_job_ledger() returns trigger language plpgsql security invoker set search_path='' as $$
declare j public.pro_jobs; due numeric; added numeric; discounted numeric; paid numeric;
begin
 if auth.uid() is null or auth.uid()<>new.professional_id then raise exception 'Access denied';end if;
 select * into j from public.pro_jobs where id=new.job_id and professional_id=auth.uid() for update;
 if not found then raise exception 'Job not found';end if;
 if new.kind='addition' and length(trim(new.description))=0 then raise exception 'Description required';end if;
 due=j.quoted_price+j.addition_total-j.adjustment_discount_total-coalesce(j.actual_paid,0);
 if new.kind in ('payment','discount') and new.amount>greatest(0,due) then raise exception 'Amount exceeds balance';end if;
 added=j.addition_total+case when new.kind='addition' then new.amount else 0 end;
 discounted=j.adjustment_discount_total+case when new.kind='discount' then new.amount else 0 end;
 paid=coalesce(j.actual_paid,0)+case when new.kind='payment' then new.amount else 0 end;
 update public.pro_jobs set addition_total=added,adjustment_discount_total=discounted,actual_paid=paid,
 payment_status=case when j.quoted_price+added-discounted-paid<=0 then 'paid' when paid>0 then 'deposit' else 'unpaid' end,
 status=case when j.status='paid' and j.quoted_price+added-discounted-paid>0 then 'completed' else j.status end
 where id=j.id;
 return new;
end $$;
create trigger apply_job_ledger before insert on public.pro_job_ledger for each row execute function mehirli_private.apply_job_ledger();
create or replace function public.record_job_ledger(p_job_id uuid,p_id uuid,p_kind text,p_amount numeric,p_description text default '') returns public.pro_jobs language plpgsql security invoker set search_path='' as $$
declare j public.pro_jobs; existing public.pro_job_ledger;
begin
 if auth.uid() is null or not public.has_my_service_access_v33() then raise exception 'Access denied';end if;
 select * into j from public.pro_jobs where id=p_job_id and professional_id=auth.uid() for update;
 if not found then raise exception 'Job not found';end if;
 select * into existing from public.pro_job_ledger where id=p_id;
 if found then
  if existing.job_id<>p_job_id or existing.kind<>p_kind or existing.amount<>p_amount or existing.description<>trim(coalesce(p_description,'')) then raise exception 'Request conflict';end if;
  return j;
 end if;
 if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'Invalid amount';end if;
 insert into public.pro_job_ledger(id,professional_id,job_id,kind,amount,description) values(p_id,auth.uid(),p_job_id,p_kind,p_amount,trim(coalesce(p_description,'')));
 select * into j from public.pro_jobs where id=p_job_id and professional_id=auth.uid();return j;
end $$;
revoke all on function public.record_job_ledger(uuid,uuid,text,numeric,text) from public,anon;
grant execute on function public.record_job_ledger(uuid,uuid,text,numeric,text) to authenticated;

-- Personal monthly summary permits confirmed manual entries without attachments.
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
  new.approved_at=coalesce(new.approved_at,now());
 end if;
 new.updated_at=clock_timestamp();return new;
end $$;



-- Owner-only, atomic quote editing. Previously accepted quotes are immutable here.
create or replace function public.edit_pro_quote_v111(p_job_id uuid, p_expected_updated_at timestamptz, p_quote jsonb, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_old public.pro_jobs;
  v_new public.pro_jobs;
  v_patch jsonb;
begin
  if auth.uid() is null or not public.has_my_service_access_v33() then raise exception 'quote_access_denied'; end if;
  select * into v_old from public.pro_jobs where id=p_job_id and professional_id=auth.uid() for update;
  if not found then raise exception 'quote_not_found'; end if;
  if v_old.client_approved_at is not null or v_old.status not in ('lead','quoted') or coalesce(v_old.actual_paid,0)>0 or v_old.addition_total>0 or v_old.adjustment_discount_total>0 then raise exception 'quote_locked'; end if;
  if p_expected_updated_at is null or v_old.updated_at is distinct from p_expected_updated_at then raise exception 'quote_changed'; end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_patch from jsonb_each(p_quote) where key = any(array['customer_id','trade','customer_name','customer_phone','city','job_type','description','scheduled_at','pricing_mode','base_price','subtotal','discount_type','discount_value','discount_amount','quote_valid_until','warranty_text','labor_hours','hourly_rate','materials_cost','travel_cost','assistant_cost','overhead_percent','risk_percent','price_floor','recommended_price','quoted_price','deposit_amount','quote_scope','quote_terms','customer_questions','tools_needed','warnings']);
  v_new := jsonb_populate_record(v_old,v_patch);
  if nullif(trim(v_new.customer_name),'') is null or nullif(trim(v_new.description),'') is null or v_new.quoted_price is null or v_new.quoted_price<0 then raise exception 'invalid_quote'; end if;
  if v_new.customer_id is not null and not exists(select 1 from public.pro_customers where id=v_new.customer_id and professional_id=auth.uid()) then raise exception 'invalid_customer'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'invalid_items'; end if;
  if exists(select 1 from jsonb_to_recordset(p_items) as x(description text,quantity numeric,unit_price numeric) where nullif(trim(x.description),'') is null or x.quantity is null or x.quantity<=0 or x.unit_price is null or x.unit_price<0) then raise exception 'invalid_items'; end if;
  update public.pro_jobs set customer_id=v_new.customer_id,
    trade=v_new.trade,
    customer_name=v_new.customer_name,
    customer_phone=v_new.customer_phone,
    city=v_new.city,
    job_type=v_new.job_type,
    description=v_new.description,
    scheduled_at=v_new.scheduled_at,
    pricing_mode=v_new.pricing_mode,
    base_price=v_new.base_price,
    subtotal=v_new.subtotal,
    discount_type=v_new.discount_type,
    discount_value=v_new.discount_value,
    discount_amount=v_new.discount_amount,
    quote_valid_until=v_new.quote_valid_until,
    warranty_text=v_new.warranty_text,
    labor_hours=v_new.labor_hours,
    hourly_rate=v_new.hourly_rate,
    materials_cost=v_new.materials_cost,
    travel_cost=v_new.travel_cost,
    assistant_cost=v_new.assistant_cost,
    overhead_percent=v_new.overhead_percent,
    risk_percent=v_new.risk_percent,
    price_floor=v_new.price_floor,
    recommended_price=v_new.recommended_price,
    quoted_price=v_new.quoted_price,
    deposit_amount=v_new.deposit_amount,
    quote_scope=v_new.quote_scope,
    quote_terms=v_new.quote_terms,
    customer_questions=v_new.customer_questions,
    tools_needed=v_new.tools_needed,
    warnings=v_new.warnings,
    public_token=gen_random_uuid(), quote_pdf_path=null, quote_pdf_generated_at=null, status='quoted'
    where id=v_old.id and professional_id=auth.uid() returning * into v_new;
  if not found then raise exception 'quote_access_denied'; end if;
  delete from public.pro_job_items where job_id=v_old.id and professional_id=auth.uid();
  insert into public.pro_job_items(job_id,professional_id,description,quantity,unit_price,estimated_cost,sort_order)
    select v_old.id,auth.uid(),x.description,x.quantity,x.unit_price,coalesce(x.estimated_cost,0),coalesce(x.sort_order,0)
    from jsonb_to_recordset(p_items) as x(description text,quantity numeric,unit_price numeric,estimated_cost numeric,sort_order integer);
  return to_jsonb(v_new);
end;
$$;
revoke all on function public.edit_pro_quote_v111(uuid,timestamptz,jsonb,jsonb) from public,anon;
grant execute on function public.edit_pro_quote_v111(uuid,timestamptz,jsonb,jsonb) to authenticated;
