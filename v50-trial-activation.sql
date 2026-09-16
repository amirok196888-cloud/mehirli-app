-- V50: create the professional trial atomically with the Auth user.
-- This removes the dependency on the browser successfully completing loadMe().

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_role text := case
    when new.raw_user_meta_data ->> 'role' = 'professional' then 'professional'
    else 'customer'
  end;
  v_trial_days integer;
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, v_role, new.raw_user_meta_data ->> 'full_name');

  insert into public.credits (user_id, balance)
  values (new.id, 0);

  if v_role = 'professional' then
    select coalesce(trial_days, 14)
      into v_trial_days
      from public.platform_billing_settings
     where singleton = true;

    insert into public.professional_subscriptions(
      professional_id,
      status,
      trial_started_at,
      trial_ends_at
    ) values (
      new.id,
      'trial',
      now(),
      now() + make_interval(days => coalesce(v_trial_days, 14))
    )
    on conflict (professional_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Repair any professional account that was created before this trigger fix.
insert into public.professional_subscriptions(
  professional_id,
  status,
  trial_started_at,
  trial_ends_at
)
select
  p.id,
  'trial',
  now(),
  now() + make_interval(days => coalesce(s.trial_days, 14))
from public.profiles p
cross join public.platform_billing_settings s
where s.singleton = true
  and p.role = 'professional'
  and not exists (
    select 1
    from public.admin_users a
    where a.user_id = p.id
  )
on conflict (professional_id) do nothing;

