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
  if v_old.client_approved_at is not null or v_old.status not in ('lead','quoted') or coalesce(v_old.actual_paid,0)>0 then raise exception 'quote_locked'; end if;
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
