-- Mehirli V83: persistent installation onboarding and per-user activation milestones.

create table if not exists public.professional_onboarding_progress (
  professional_id uuid primary key references auth.users(id) on delete cascade,
  registered_at timestamptz not null default now(),
  install_clicked_at timestamptz,
  installed_at timestamptz,
  first_quote_created_at timestamptz,
  first_quote_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.professional_onboarding_progress enable row level security;
revoke all on table public.professional_onboarding_progress from public, anon, authenticated;

insert into public.professional_onboarding_progress(
  professional_id, registered_at, install_clicked_at, installed_at,
  first_quote_created_at, first_quote_sent_at, updated_at
)
select
  u.id,
  coalesce(p.created_at, u.created_at, now()),
  install_click.first_at,
  standalone_open.first_at,
  first_quote.first_at,
  first_sent.first_at,
  now()
from auth.users u
join public.profiles p on p.id = u.id and p.role = 'professional'
left join lateral (
  select min(e.created_at) first_at
  from public.app_analytics_events e
  where e.user_id = u.id and e.event_name in ('app_installed','standalone_open')
) install_click on true
left join lateral (
  select min(e.created_at) first_at
  from public.app_analytics_events e
  where e.user_id = u.id and e.event_name = 'standalone_open'
) standalone_open on true
left join lateral (
  select min(j.created_at) first_at
  from public.pro_jobs j where j.professional_id = u.id
) first_quote on true
left join lateral (
  select min(e.created_at) first_at
  from public.app_analytics_events e
  where e.user_id = u.id and e.event_name = 'quote_send_opened'
) first_sent on true
on conflict (professional_id) do update set
  registered_at = least(public.professional_onboarding_progress.registered_at, excluded.registered_at),
  install_clicked_at = coalesce(public.professional_onboarding_progress.install_clicked_at, excluded.install_clicked_at),
  installed_at = coalesce(public.professional_onboarding_progress.installed_at, excluded.installed_at),
  first_quote_created_at = coalesce(public.professional_onboarding_progress.first_quote_created_at, excluded.first_quote_created_at),
  first_quote_sent_at = coalesce(public.professional_onboarding_progress.first_quote_sent_at, excluded.first_quote_sent_at),
  updated_at = now();

create or replace function public.ensure_professional_onboarding_v83()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.role = 'professional' then
    insert into public.professional_onboarding_progress(professional_id, registered_at)
    values (new.id, coalesce(new.created_at, now()))
    on conflict (professional_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_professional_onboarding_v83() from public, anon, authenticated;

drop trigger if exists trg_ensure_professional_onboarding_v83 on public.profiles;
create trigger trg_ensure_professional_onboarding_v83
after insert or update of role on public.profiles
for each row execute function public.ensure_professional_onboarding_v83();

create or replace function public.mark_first_quote_created_v83()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  insert into public.professional_onboarding_progress(
    professional_id, registered_at, first_quote_created_at, updated_at
  )
  values (new.professional_id, now(), new.created_at, now())
  on conflict (professional_id) do update set
    first_quote_created_at = coalesce(
      public.professional_onboarding_progress.first_quote_created_at,
      excluded.first_quote_created_at
    ),
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.mark_first_quote_created_v83() from public, anon, authenticated;

drop trigger if exists trg_mark_first_quote_created_v83 on public.pro_jobs;
create trigger trg_mark_first_quote_created_v83
after insert on public.pro_jobs
for each row execute function public.mark_first_quote_created_v83();

create or replace function public.mark_my_onboarding_step_v83(p_step text)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_row public.professional_onboarding_progress;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user and p.role = 'professional'
  ) then raise exception 'not_professional'; end if;
  if p_step not in ('install_clicked','installed','first_quote_sent') then
    raise exception 'invalid_onboarding_step';
  end if;

  insert into public.professional_onboarding_progress(professional_id, registered_at)
  select v_user, coalesce(p.created_at, now()) from public.profiles p where p.id = v_user
  on conflict (professional_id) do nothing;

  if p_step = 'install_clicked' then
    update public.professional_onboarding_progress
       set install_clicked_at = coalesce(install_clicked_at, now()), updated_at = now()
     where professional_id = v_user;
  elsif p_step = 'installed' then
    update public.professional_onboarding_progress
       set install_clicked_at = coalesce(install_clicked_at, now()),
           installed_at = coalesce(installed_at, now()), updated_at = now()
     where professional_id = v_user;
  else
    if not exists (select 1 from public.pro_jobs j where j.professional_id = v_user) then
      raise exception 'quote_not_created';
    end if;
    update public.professional_onboarding_progress
       set first_quote_created_at = coalesce(
             first_quote_created_at,
             (select min(j.created_at) from public.pro_jobs j where j.professional_id = v_user)
           ),
           first_quote_sent_at = coalesce(first_quote_sent_at, now()), updated_at = now()
     where professional_id = v_user;
  end if;

  select * into v_row from public.professional_onboarding_progress where professional_id = v_user;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.mark_my_onboarding_step_v83(text) from public, anon;
grant execute on function public.mark_my_onboarding_step_v83(text) to authenticated;

create or replace function public.get_my_onboarding_progress_v83()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_row public.professional_onboarding_progress;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user and p.role = 'professional'
  ) then raise exception 'not_professional'; end if;

  insert into public.professional_onboarding_progress(professional_id, registered_at)
  select v_user, coalesce(p.created_at, now()) from public.profiles p where p.id = v_user
  on conflict (professional_id) do nothing;

  select * into v_row from public.professional_onboarding_progress where professional_id = v_user;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.get_my_onboarding_progress_v83() from public, anon;
grant execute on function public.get_my_onboarding_progress_v83() to authenticated;

create or replace function public.admin_list_businesses_v83()
returns table(
  professional_id uuid, email text, business_name text, trade text, service_areas text[],
  job_count bigint, revenue numeric, is_admin boolean, subscription_status text,
  trial_ends_at timestamptz, current_period_ends_at timestamptz, grace_ends_at timestamptz,
  last_payment_at timestamptz, last_payment_amount numeric, pending_payment_count bigint,
  registered_at timestamptz, install_clicked_at timestamptz, installed_at timestamptz,
  first_quote_created_at timestamptz, first_quote_sent_at timestamptz
)
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
begin
  if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;
  return query
  select
    u.id, u.email::text,
    coalesce(nullif(bp.business_name,''), nullif(u.raw_user_meta_data->>'full_name',''), u.email::text, 'בעל עסק')::text,
    coalesce(ps.trade, case bp.specialties[1]
      when 'היינדמן' then 'handyman' when 'הנדימן' then 'handyman' when 'חשמלאי' then 'electrician'
      when 'לבית' then 'home' when 'שירותי בית' then 'home' when 'מיזוג' then 'air_conditioning'
      else 'handyman' end, 'handyman')::text,
    coalesce(bp.service_areas, array[]::text[]),
    (select count(*) from public.pro_jobs j where j.professional_id = u.id),
    (select coalesce(sum(j.actual_paid),0) from public.pro_jobs j where j.professional_id = u.id),
    (a.user_id is not null),
    case when a.user_id is not null then 'admin' else coalesce(s.status, 'not_started') end,
    s.trial_ends_at, s.current_period_ends_at, s.grace_ends_at,
    s.last_payment_at, s.last_payment_amount,
    (select count(*) from public.subscription_payment_reports r where r.professional_id = u.id and r.status = 'pending'),
    coalesce(op.registered_at, p.created_at, u.created_at), op.install_clicked_at, op.installed_at,
    op.first_quote_created_at, op.first_quote_sent_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.business_profiles bp on bp.user_id = u.id
  left join public.professional_settings ps on ps.professional_id = u.id
  left join public.professional_subscriptions s on s.professional_id = u.id
  left join public.admin_users a on a.user_id = u.id
  left join public.professional_onboarding_progress op on op.professional_id = u.id
  where p.role = 'professional' or bp.user_id is not null or ps.professional_id is not null or a.user_id is not null
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_businesses_v83() from public, anon;
grant execute on function public.admin_list_businesses_v83() to authenticated;
