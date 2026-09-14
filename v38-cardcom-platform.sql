-- מחירלי V38 — תשתית תשלום אוטומטי בקארדקום
-- ברירת המחדל נשארת "manual". רק לאחר אישור קארדקום והגדרת הסודות
-- בצד השרת יש לשנות payment_mode ל-cardcom.

alter table public.platform_billing_settings
  add column if not exists payment_mode text not null default 'manual',
  add column if not exists cardcom_product_code text not null default 'MEHIRLI-MONTHLY',
  add column if not exists merchant_brand_label text not null default 'ROKACH DIGITAL';

alter table public.platform_billing_settings
  drop constraint if exists platform_billing_settings_payment_mode_allowed;

alter table public.platform_billing_settings
  add constraint platform_billing_settings_payment_mode_allowed
  check (payment_mode in ('manual', 'cardcom'));

create table if not exists public.platform_payment_orders (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null default 'MEHIRLI-MONTHLY',
  provider text not null default 'cardcom' check (provider in ('cardcom')),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'ILS' check (currency = 'ILS'),
  status text not null default 'created'
    check (status in ('created','checkout_ready','paid','failed','cancelled','expired','refunded')),
  provider_low_profile_id uuid,
  provider_transaction_id bigint,
  provider_document_number text,
  provider_document_url text,
  checkout_url text,
  provider_response_code integer,
  provider_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  paid_at timestamptz
);

comment on table public.platform_payment_orders is
  'Server-owned payment orders for the Mehirli platform subscription. No card data or Cardcom credentials are stored here.';

create unique index if not exists platform_payment_orders_low_profile_unique
  on public.platform_payment_orders(provider, provider_low_profile_id)
  where provider_low_profile_id is not null;

create unique index if not exists platform_payment_orders_transaction_unique
  on public.platform_payment_orders(provider, provider_transaction_id)
  where provider_transaction_id is not null;

create index if not exists platform_payment_orders_owner_created_idx
  on public.platform_payment_orders(professional_id, created_at desc);

alter table public.platform_payment_orders enable row level security;

drop policy if exists platform_payment_orders_select_own on public.platform_payment_orders;
create policy platform_payment_orders_select_own
on public.platform_payment_orders for select
to authenticated
using ((select auth.uid()) = professional_id);

drop policy if exists platform_payment_orders_select_admin on public.platform_payment_orders;
create policy platform_payment_orders_select_admin
on public.platform_payment_orders for select
to authenticated
using (public.is_mehirli_admin());

revoke all on public.platform_payment_orders from anon, authenticated, public;
grant select on public.platform_payment_orders to authenticated;

create schema if not exists mehirli_private;

create or replace function mehirli_private.activate_subscription_from_paid_order_v38()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    insert into public.professional_subscriptions(
      professional_id, status, current_period_starts_at, current_period_ends_at,
      last_payment_at, last_payment_amount, updated_at
    )
    values (
      new.professional_id, 'active', now(), now() + interval '30 days',
      coalesce(new.paid_at, now()), new.amount, now()
    )
    on conflict (professional_id) do update
      set status = 'active',
          current_period_starts_at = case
            when public.professional_subscriptions.current_period_ends_at is null
              or public.professional_subscriptions.current_period_ends_at < now()
            then now()
            else public.professional_subscriptions.current_period_starts_at
          end,
          current_period_ends_at = greatest(
            coalesce(public.professional_subscriptions.current_period_ends_at, now()), now()
          ) + interval '30 days',
          grace_ends_at = null,
          last_payment_at = coalesce(new.paid_at, now()),
          last_payment_amount = new.amount,
          failure_reason = null,
          updated_at = now();

    insert into public.subscription_payment_reports(
      professional_id, amount, status, reference_note, decided_at
    ) values (
      new.professional_id,
      new.amount,
      'approved',
      left('Cardcom · ' || new.product_code || ' · order ' || new.id::text, 250),
      coalesce(new.paid_at, now())
    );

    insert into public.notifications(user_id, kind, title, body, data)
    values (
      new.professional_id,
      'subscription_status',
      'התשלום התקבל והמנוי הופעל',
      'התשלום עבור מנוי מחירלי נקלט בהצלחה. החשבונית נשלחת על ידי קארדקום.',
      jsonb_build_object('status','active','payment_order_id',new.id)
    );

    if new.provider_message = 'payment_paid_document_requires_attention' then
      insert into public.notifications(user_id, kind, title, body, data)
      select
        user_id,
        'subscription_payment_attention',
        'תשלום נקלט — החשבונית דורשת בדיקה',
        'מנוי מחירלי הופעל, אך קארדקום לא אישרה שהחשבונית הופקה. יש לבדוק במסוף קארדקום.',
        jsonb_build_object('payment_order_id',new.id,'professional_id',new.professional_id)
      from public.admin_users;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function mehirli_private.activate_subscription_from_paid_order_v38() from public;

drop trigger if exists trg_activate_subscription_from_paid_order_v38 on public.platform_payment_orders;
create trigger trg_activate_subscription_from_paid_order_v38
before update of status on public.platform_payment_orders
for each row execute function mehirli_private.activate_subscription_from_paid_order_v38();

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
    insert into public.professional_subscriptions(professional_id, status, trial_ends_at)
    values (v_user, 'trial', now() + make_interval(days => coalesce(v_settings.trial_days, 14)))
    on conflict (professional_id) do nothing;

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
      'id', id,
      'status', status,
      'amount', amount,
      'created_at', created_at,
      'paid_at', paid_at,
      'document_number', provider_document_number
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

create or replace function public.admin_get_billing_settings_v38()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_settings public.platform_billing_settings;
begin
  if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;
  select * into v_settings from public.platform_billing_settings where singleton = true;
  return to_jsonb(v_settings);
end;
$$;

revoke all on function public.admin_get_billing_settings_v38() from anon, authenticated, public;
grant execute on function public.admin_get_billing_settings_v38() to authenticated;

-- הפעלה רק לאחר אישור קארדקום והגדרת CARDCOM_TERMINAL_NUMBER + CARDCOM_API_NAME:
-- update public.platform_billing_settings set payment_mode='cardcom', updated_at=now() where singleton=true;
