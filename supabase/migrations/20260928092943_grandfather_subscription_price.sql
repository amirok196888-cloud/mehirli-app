-- User approved on 2026-09-28: existing registrations keep 29 ILS, new ones pay 39 ILS.
-- Preserve the offer accepted by existing registrants; new subscriptions snapshot the current public price.
alter table public.professional_subscriptions add column monthly_price numeric(10,2);
update public.professional_subscriptions set monthly_price=29 where monthly_price is null;
create or replace function mehirli_private.set_subscription_price_v134() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.monthly_price is null then
  select case when u.created_at <= timestamptz '2026-09-28 09:35:31+00' then 29
   else 39 end
  into new.monthly_price from auth.users u where u.id=new.professional_id;
 end if;
 if new.monthly_price is null or new.monthly_price<=0 then raise exception 'invalid_subscription_price';end if;
 return new;
end $$;
create trigger set_subscription_price_v134 before insert on public.professional_subscriptions for each row execute function mehirli_private.set_subscription_price_v134();
alter table public.professional_subscriptions alter column monthly_price set not null;
alter table public.professional_subscriptions add constraint subscription_positive_price check(monthly_price>0);

CREATE OR REPLACE FUNCTION public.admin_subscription_action_v33(p_professional_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_sub public.professional_subscriptions;
  v_price numeric(10,2);
  v_trial_days integer;
  v_updated integer;
begin
  if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;
  if exists(select 1 from public.admin_users where user_id = p_professional_id) then raise exception 'admin_not_billable'; end if;
  if p_action not in ('record_payment','activate','suspend','extend_trial','reject_payment') then raise exception 'invalid_action'; end if;

  select monthly_price, trial_days into v_price, v_trial_days from public.platform_billing_settings where singleton = true;
  insert into public.professional_subscriptions(professional_id, status, trial_ends_at)
  values (p_professional_id, 'trial', now() + make_interval(days => coalesce(v_trial_days,14)))
  on conflict (professional_id) do nothing;
  select monthly_price into v_price from public.professional_subscriptions where professional_id=p_professional_id;

  if p_action = 'record_payment' then
    update public.professional_subscriptions
       set status = 'active',
           current_period_starts_at = now(),
           current_period_ends_at = greatest(coalesce(current_period_ends_at, now()), now()) + interval '30 days',
           grace_ends_at = null, last_payment_at = now(), last_payment_amount = v_price,
           failure_reason = null, updated_at = now()
     where professional_id = p_professional_id returning * into v_sub;
    update public.subscription_payment_reports set status='approved', decided_at=now(), decided_by=auth.uid()
     where professional_id=p_professional_id and status='pending';
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      insert into public.subscription_payment_reports(professional_id,amount,status,reference_note,decided_at,decided_by)
      values(p_professional_id,v_price,'approved','תשלום תועד ידנית במנהל',now(),auth.uid());
    end if;
  elsif p_action = 'activate' then
    update public.professional_subscriptions
       set status='active', current_period_starts_at=now(),
           current_period_ends_at=case when current_period_ends_at >= now() then current_period_ends_at else now()+interval '30 days' end,
           grace_ends_at=null, failure_reason=null, updated_at=now()
     where professional_id=p_professional_id returning * into v_sub;
  elsif p_action = 'suspend' then
    update public.professional_subscriptions set status='suspended', failure_reason='השירות הושהה על ידי המנהל', updated_at=now()
     where professional_id=p_professional_id returning * into v_sub;
  elsif p_action = 'extend_trial' then
    update public.professional_subscriptions
       set status='trial', trial_ends_at=greatest(coalesce(trial_ends_at,now()),now())+interval '7 days',
           grace_ends_at=null, failure_reason=null, updated_at=now()
     where professional_id=p_professional_id returning * into v_sub;
  else
    update public.subscription_payment_reports set status='rejected', decided_at=now(), decided_by=auth.uid()
     where professional_id=p_professional_id and status='pending';
    select * into v_sub from public.professional_subscriptions where professional_id=p_professional_id;
  end if;

  if p_action in ('record_payment','activate','suspend','extend_trial') then
    insert into public.notifications(user_id,kind,title,body,data)
    values (p_professional_id,'subscription_status',
      case p_action when 'suspend' then 'השירות הושהה' when 'extend_trial' then 'תקופת הניסיון הוארכה' else 'המנוי פעיל' end,
      case p_action when 'suspend' then 'יש להסדיר את התשלום כדי לחזור להשתמש במחירלי.' when 'extend_trial' then 'נוספו 7 ימים לתקופת הניסיון שלך.' else 'אפשר להמשיך לעבוד במחירלי.' end,
      jsonb_build_object('status',v_sub.status));
  end if;

  return to_jsonb(v_sub);
end;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_subscription_v33()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'mehirli_private', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_admin boolean;
  v_settings public.platform_billing_settings;
  v_sub public.professional_subscriptions;
  v_pending public.subscription_payment_reports;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select exists(select 1 from public.admin_users where user_id = v_user) into v_admin;
  select * into v_settings from public.platform_billing_settings where singleton = true;

  if not v_admin then
    insert into public.professional_subscriptions(professional_id, status, trial_ends_at)
    values (v_user, 'trial', now() + make_interval(days => coalesce(v_settings.trial_days, 14)))
    on conflict (professional_id) do nothing;

    update public.professional_subscriptions
       set status = 'past_due',
           grace_ends_at = coalesce(grace_ends_at, current_period_ends_at + make_interval(days => coalesce(v_settings.grace_days, 2))),
           failure_reason = coalesce(failure_reason, 'תקופת המנוי הסתיימה'),
           updated_at = now()
     where professional_id = v_user
       and status = 'active'
       and current_period_ends_at < now();

    update public.professional_subscriptions
       set status = 'suspended', updated_at = now()
     where professional_id = v_user
       and (
         (status = 'trial' and trial_ends_at < now())
         or (status = 'past_due' and grace_ends_at < now())
       );

    select * into v_sub from public.professional_subscriptions where professional_id = v_user;
    select * into v_pending from public.subscription_payment_reports
     where professional_id = v_user and status = 'pending'
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
    'monthly_price', coalesce(v_sub.monthly_price, v_settings.monthly_price, 39),
    'trial_days', coalesce(v_settings.trial_days, 14),
    'grace_days', coalesce(v_settings.grace_days, 2),
    'payment_url', nullif(v_settings.payment_url, ''),
    'support_whatsapp', v_settings.support_whatsapp
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_subscription_v38()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'mehirli_private', 'pg_temp'
AS $function$
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
    'monthly_price', coalesce(v_sub.monthly_price, v_settings.monthly_price, 39),
    'trial_days', coalesce(v_settings.trial_days, 14),
    'grace_days', 2,
    'payment_url', nullif(v_settings.payment_url, ''),
    'payment_mode', coalesce(v_settings.payment_mode, 'manual'),
    'merchant_brand_label', coalesce(v_settings.merchant_brand_label, 'ROKACH DIGITAL'),
    'support_whatsapp', v_settings.support_whatsapp,
    'latest_payment_order', v_latest_order
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.report_subscription_payment_v33(p_reference_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_price numeric(10,2);
  v_report public.subscription_payment_reports;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if exists(select 1 from public.admin_users where user_id = v_user) then raise exception 'admin_not_billable'; end if;

  perform public.get_my_subscription_v38();
  select monthly_price into v_price from public.professional_subscriptions where professional_id=v_user;
  if v_price is null then raise exception 'subscription_price_unavailable';end if;
  select * into v_report from public.subscription_payment_reports
   where professional_id = v_user and status = 'pending'
   order by created_at desc limit 1;

  if v_report.id is null then
    insert into public.subscription_payment_reports(professional_id, amount, reference_note)
    values (v_user, v_price, nullif(left(trim(coalesce(p_reference_note, '')), 250), ''))
    returning * into v_report;

    insert into public.notifications(user_id, kind, title, body, data)
    select a.user_id, 'subscription_payment_pending', 'תשלום מנוי ממתין לאישור',
           coalesce(bp.business_name, p.full_name, 'בעל עסק') || ' דיווח/ה על תשלום מנוי.',
           jsonb_build_object('professional_id', v_user, 'payment_report_id', v_report.id)
      from public.admin_users a
      left join public.business_profiles bp on bp.user_id = v_user
      left join public.profiles p on p.id = v_user;
  end if;

  return jsonb_build_object('report_id', v_report.id, 'status', v_report.status, 'created_at', v_report.created_at);
end;
$function$;


