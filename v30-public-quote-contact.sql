-- מחירלי V30 — WhatsApp לבעל העסק ותשלום אופציונלי בהצעה הציבורית

drop function if exists public.get_public_job_quote(uuid);

create function public.get_public_job_quote(p_token uuid)
returns table(
  job_id uuid,
  business_name text,
  business_phone text,
  trade text,
  customer_name text,
  description text,
  quote_scope text,
  quoted_price numeric,
  deposit_amount numeric,
  quote_terms text,
  scheduled_at timestamptz,
  status text,
  payment_link text,
  electrician_license_number text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    j.id,
    coalesce(bp.business_name, p.full_name, 'בעל מקצוע'),
    bp.business_phone,
    j.trade,
    j.customer_name,
    j.description,
    j.quote_scope,
    j.quoted_price,
    j.deposit_amount,
    j.quote_terms,
    j.scheduled_at,
    j.status,
    s.payment_link,
    case when j.trade = 'electrician' then s.electrician_license_number else null end
  from public.pro_jobs j
  left join public.business_profiles bp on bp.user_id = j.professional_id
  left join public.profiles p on p.id = j.professional_id
  left join public.professional_settings s on s.professional_id = j.professional_id
  where j.public_token = p_token
    and j.status <> 'cancelled'
  limit 1;
$$;

revoke all on function public.get_public_job_quote(uuid) from public, anon, authenticated;
grant execute on function public.get_public_job_quote(uuid) to anon, authenticated;

select 'V30 public quote contact ready' as status;
