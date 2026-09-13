-- מחירלי V28 — ארבע קטגוריות וכניסת מנהל מאובטחת

alter table public.professional_settings
  drop constraint if exists professional_settings_trade_check;
alter table public.professional_settings
  add constraint professional_settings_trade_check
  check (trade in ('handyman','electrician','home','air_conditioning'));

alter table public.pro_jobs
  drop constraint if exists pro_jobs_trade_check;
alter table public.pro_jobs
  add constraint pro_jobs_trade_check
  check (trade in ('handyman','electrician','home','air_conditioning'));

create or replace function public.admin_professional_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_mehirli_admin() then
    raise exception 'not_admin';
  end if;

  select jsonb_build_object(
    'businesses', (
      select count(distinct u.id)
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join public.business_profiles bp on bp.user_id = u.id
      left join public.professional_settings ps on ps.professional_id = u.id
      where p.role = 'professional'
         or bp.user_id is not null
         or ps.professional_id is not null
    ),
    'jobs', (select count(*) from public.pro_jobs),
    'open_jobs', (
      select count(*) from public.pro_jobs
      where status not in ('paid','cancelled')
    ),
    'revenue', (
      select coalesce(sum(actual_paid),0) from public.pro_jobs
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_list_pro_jobs()
returns table(
  job_id uuid,
  business_name text,
  trade text,
  customer_name text,
  city text,
  description text,
  status text,
  payment_status text,
  quoted_price numeric,
  actual_paid numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_mehirli_admin() then
    raise exception 'not_admin';
  end if;

  return query
  select
    j.id,
    coalesce(nullif(bp.business_name,''), nullif(u.raw_user_meta_data->>'full_name',''), u.email::text, 'עסק ללא שם')::text,
    j.trade,
    j.customer_name,
    j.city,
    j.description,
    j.status,
    j.payment_status,
    j.quoted_price,
    j.actual_paid,
    j.created_at
  from public.pro_jobs j
  join auth.users u on u.id = j.professional_id
  left join public.business_profiles bp on bp.user_id = j.professional_id
  order by j.created_at desc;
end;
$$;

create or replace function public.admin_list_businesses_v28()
returns table(
  professional_id uuid,
  email text,
  business_name text,
  trade text,
  service_areas text[],
  job_count bigint,
  revenue numeric
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_mehirli_admin() then
    raise exception 'not_admin';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(nullif(bp.business_name,''), nullif(u.raw_user_meta_data->>'full_name',''), u.email::text, 'בעל עסק')::text,
    coalesce(
      ps.trade,
      case bp.specialties[1]
        when 'היינדמן' then 'handyman'
        when 'הנדימן' then 'handyman'
        when 'חשמלאי' then 'electrician'
        when 'לבית' then 'home'
        when 'שירותי בית' then 'home'
        when 'מיזוג' then 'air_conditioning'
        else null
      end,
      'handyman'
    )::text,
    coalesce(bp.service_areas, array[]::text[]),
    (select count(*) from public.pro_jobs j where j.professional_id = u.id),
    (select coalesce(sum(j.actual_paid),0) from public.pro_jobs j where j.professional_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.business_profiles bp on bp.user_id = u.id
  left join public.professional_settings ps on ps.professional_id = u.id
  where p.role = 'professional'
     or bp.user_id is not null
     or ps.professional_id is not null
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_professional_summary() from public, anon, authenticated;
revoke all on function public.admin_list_pro_jobs() from public, anon, authenticated;
revoke all on function public.admin_list_businesses_v28() from public, anon, authenticated;

grant execute on function public.admin_professional_summary() to authenticated;
grant execute on function public.admin_list_pro_jobs() to authenticated;
grant execute on function public.admin_list_businesses_v28() to authenticated;

select 'V28 admin and all categories ready' as status;
