-- מחירלי V24 — מרכז התראות אוטומטי
-- מריצים פעם אחת ב-Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read)
  where is_read = false;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, update on public.notifications to authenticated;

-- 1) עבודה חדשה -> בעלי מקצוע בתחום המתאים
create or replace function public.notify_new_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_he text;
begin
  v_category_he := case new.category::text
    when 'vehicle' then 'רכב'
    when 'air_conditioning' then 'מיזוג'
    when 'home' then 'לבית'
    when 'handyman' then 'הנדימן'
    else new.category::text
  end;

  insert into public.notifications(user_id, kind, title, body, data)
  select distinct
    bp.user_id,
    'new_job',
    'עבודה חדשה בתחום שלך',
    coalesce(v_category_he,'עבודה') || ' · ' || coalesce(new.city,'') || ' — ' || left(coalesce(new.description,''),120),
    jsonb_build_object('request_id',new.id,'category',new.category::text,'city',new.city)
  from public.business_profiles bp
  join public.profiles p on p.id=bp.user_id
  where p.role='professional'
    and bp.user_id <> new.customer_id
    and (
      bp.specialties is null
      or cardinality(bp.specialties)=0
      or v_category_he = any(bp.specialties)
      or new.category::text = any(bp.specialties)
    );

  return new;
end $$;

drop trigger if exists trg_notify_new_request on public.requests;
create trigger trg_notify_new_request
after insert on public.requests
for each row execute function public.notify_new_request();

-- 2) הצעה חדשה -> הלקוח שפרסם את הבקשה
create or replace function public.notify_new_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_business text;
begin
  select r.customer_id into v_customer
  from public.requests r where r.id=new.request_id;

  select bp.business_name into v_business
  from public.business_profiles bp
  where bp.user_id=new.professional_id;

  if v_customer is not null then
    insert into public.notifications(user_id,kind,title,body,data)
    values(
      v_customer,
      'new_quote',
      'קיבלת הצעת מחיר חדשה',
      coalesce(v_business,'בעל מקצוע') || ' שלח לך הצעה.',
      jsonb_build_object('request_id',new.request_id,'quote_id',new.id)
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_new_quote on public.quotes;
create trigger trg_notify_new_quote
after insert on public.quotes
for each row execute function public.notify_new_quote();

-- 3) "שילמתי" -> כל מנהלי מחירלי
create or replace function public.notify_payment_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.status='pending' then
    select coalesce(p.full_name,u.email,'בעל מקצוע')
      into v_name
    from auth.users u
    left join public.profiles p on p.id=u.id
    where u.id=new.user_id;

    insert into public.notifications(user_id,kind,title,body,data)
    select
      a.user_id,
      'payment_pending',
      'תשלום חדש ממתין לאישור',
      coalesce(v_name,'בעל מקצוע') || ' סימן ששילם ' || new.amount || ' ₪ עבור ' || new.credits || ' הצעות.',
      jsonb_build_object('payment_id',new.id,'payer_user_id',new.user_id)
    from public.admin_users a;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_payment_pending on public.payment_requests;
create trigger trg_notify_payment_pending
after insert on public.payment_requests
for each row execute function public.notify_payment_pending();

-- 4) לקוח בחר הצעה -> בעל המקצוע שנבחר
create or replace function public.notify_quote_selected()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professional uuid;
begin
  if new.selected_quote_id is not null
     and new.selected_quote_id is distinct from old.selected_quote_id then
    select q.professional_id into v_professional
    from public.quotes q where q.id=new.selected_quote_id;

    if v_professional is not null then
      insert into public.notifications(user_id,kind,title,body,data)
      values(
        v_professional,
        'quote_selected',
        'הלקוח בחר בהצעה שלך 🎉',
        left(coalesce(new.description,'העבודה'),120) || ' · פרטי הקשר פתוחים עכשיו.',
        jsonb_build_object('request_id',new.id,'quote_id',new.selected_quote_id)
      );
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_quote_selected on public.requests;
create trigger trg_notify_quote_selected
after update of selected_quote_id on public.requests
for each row execute function public.notify_quote_selected();

-- בדיקת התקנה
select 'V24 notifications ready' as status;
