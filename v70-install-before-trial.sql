-- Mehirli V70: a professional trial starts only after the PWA installation step.

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
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, v_role, new.raw_user_meta_data ->> 'full_name');

  insert into public.credits (user_id, balance)
  values (new.id, 0);

  if v_role = 'professional' then
    insert into public.professional_subscriptions(
      professional_id, status, trial_started_at, trial_ends_at, failure_reason
    ) values (
      new.id, 'suspended', now(), null, 'installation_required'
    )
    on conflict (professional_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.activate_my_trial_after_install_v70()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_trial_days integer;
  v_sub public.professional_subscriptions;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select coalesce(trial_days, 14) into v_trial_days
  from public.platform_billing_settings where singleton = true;

  update public.professional_subscriptions
     set status = 'trial',
         trial_started_at = now(),
         trial_ends_at = now() + make_interval(days => coalesce(v_trial_days, 14)),
         failure_reason = null,
         updated_at = now()
   where professional_id = v_user
     and status = 'suspended'
     and failure_reason = 'installation_required'
  returning * into v_sub;

  if v_sub.professional_id is null then
    select * into v_sub from public.professional_subscriptions
    where professional_id = v_user;
  end if;

  return jsonb_build_object(
    'status', v_sub.status,
    'trial_started_at', v_sub.trial_started_at,
    'trial_ends_at', v_sub.trial_ends_at,
    'activated', v_sub.status = 'trial' and v_sub.trial_ends_at >= now()
  );
end;
$$;

revoke all on function public.activate_my_trial_after_install_v70() from public, anon, authenticated;
grant execute on function public.activate_my_trial_after_install_v70() to authenticated;

create or replace function public.get_my_subscription_v38()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'mehirli_private', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_admin boolean;
  v_settings public.platform_billing_settings;
  v_sub public.professional_subscriptions;
  v_pending public.subscription_payment_reports;
  v_latest_order jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select exists(select 1 from public.admin_users where user_id = v_user) into v_admin;
  select * into v_settings from public.platform_billing_settings where singleton = true;

  if not v_admin then
    insert into public.professional_subscriptions(
      professional_id, status, trial_started_at, trial_ends_at, failure_reason
    ) values (
      v_user, 'suspended', now(), null, 'installation_required'
    ) on conflict (professional_id) do nothing;

    update public.professional_subscriptions
       set status = 'past_due',
           grace_ends_at = coalesce(grace_ends_at, current_period_ends_at + interval '48 hours'),
           failure_reason = coalesce(failure_reason, 'תקופת המנוי הסתיימה'),
           updated_at = now()
     where professional_id = v_user and status = 'active' and current_period_ends_at < now();

    update public.professional_subscriptions
       set status = 'suspended', updated_at = now()
     where professional_id = v_user
       and ((status = 'trial' and trial_ends_at < now())
         or (status = 'past_due' and grace_ends_at < now()));

    update public.platform_payment_orders
       set status = 'expired', updated_at = now()
     where professional_id = v_user
       and status in ('created','checkout_ready')
       and expires_at < now();

    select * into v_sub from public.professional_subscriptions where professional_id = v_user;
    select * into v_pending from public.subscription_payment_reports
     where professional_id = v_user and status = 'pending'
     order by created_at desc limit 1;

    select jsonb_build_object(
      'id', id, 'status', status, 'amount', amount, 'created_at', created_at,
      'paid_at', paid_at, 'document_number', provider_document_number
    ) into v_latest_order
    from public.platform_payment_orders
    where professional_id = v_user
    order by created_at desc limit 1;
  end if;

  return jsonb_build_object(
    'is_admin', v_admin,
    'status', case when v_admin then 'admin' else v_sub.status end,
    'has_access', case when v_admin then true else mehirli_private.professional_has_service_access_v33(v_user) end,
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_ends_at', v_sub.current_period_ends_at,
    'grace_ends_at', v_sub.grace_ends_at,
    'last_payment_at', v_sub.last_payment_at,
    'last_payment_amount', v_sub.last_payment_amount,
    'failure_reason', v_sub.failure_reason,
    'pending_payment', v_pending.id is not null,
    'pending_payment_at', v_pending.created_at,
    'monthly_price', coalesce(v_settings.monthly_price, 49),
    'trial_days', coalesce(v_settings.trial_days, 14),
    'grace_days', 2,
    'payment_url', nullif(v_settings.payment_url, ''),
    'payment_mode', coalesce(v_settings.payment_mode, 'manual'),
    'merchant_brand_label', coalesce(v_settings.merchant_brand_label, 'ROKACH DIGITAL'),
    'support_whatsapp', v_settings.support_whatsapp,
    'latest_payment_order', v_latest_order
  );
end;
$$;

revoke all on function public.get_my_subscription_v38() from anon, authenticated, public;
grant execute on function public.get_my_subscription_v38() to authenticated;
