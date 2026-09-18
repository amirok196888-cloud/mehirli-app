-- מחירלי V60 — פרטי העסק המלאים בהצעה הציבורית וב-PDF
-- אין כאן הפקת חשבונית מס; חשבוניות וקבלות נשארות באחריות מערכת החשבוניות/הסליקה של העסק.

drop function if exists public.get_public_job_quote(uuid);

create function public.get_public_job_quote(p_token uuid)
returns table(
  job_id uuid,
  business_name text,
  business_phone text,
  logo_path text,
  legal_name text,
  business_number text,
  business_email text,
  business_address text,
  trade text,
  customer_name text,
  description text,
  quote_scope text,
  quote_number integer,
  pricing_mode text,
  subtotal numeric,
  discount_amount numeric,
  quoted_price numeric,
  deposit_amount numeric,
  quote_terms text,
  quote_valid_until date,
  warranty_text text,
  scheduled_at timestamptz,
  status text,
  payment_link text,
  electrician_license_number text,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    j.id,
    coalesce(nullif(bp.business_name,''),nullif(p.full_name,''),'בעל מקצוע'),
    bp.business_phone,
    bp.logo_path,
    bp.legal_name,
    bp.business_number,
    bp.business_email,
    bp.business_address,
    j.trade,
    j.customer_name,
    j.description,
    j.quote_scope,
    j.quote_number,
    j.pricing_mode,
    j.subtotal,
    j.discount_amount,
    j.quoted_price,
    j.deposit_amount,
    j.quote_terms,
    j.quote_valid_until,
    j.warranty_text,
    j.scheduled_at,
    j.status,
    s.payment_link,
    case when j.trade='electrician' then s.electrician_license_number else null end,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description',i.description,
        'quantity',i.quantity,
        'unit_price',i.unit_price,
        'line_total',i.quantity*i.unit_price
      ) order by i.sort_order,i.created_at)
      from public.pro_job_items i
      where i.job_id=j.id
    ),'[]'::jsonb)
  from public.pro_jobs j
  left join public.business_profiles bp on bp.user_id=j.professional_id
  left join public.profiles p on p.id=j.professional_id
  left join public.professional_settings s on s.professional_id=j.professional_id
  where j.public_token=p_token
    and j.status<>'cancelled'
    and (
      j.quote_valid_until is null
      or j.quote_valid_until>=current_date
      or j.status in ('approved','scheduled','in_progress','completed','paid')
    )
  limit 1;
$$;

revoke all on function public.get_public_job_quote(uuid) from public, anon, authenticated;
grant execute on function public.get_public_job_quote(uuid) to anon, authenticated;

select 'V60 business document details ready' as status;
