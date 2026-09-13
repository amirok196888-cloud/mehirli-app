-- מחירלי V25 — מרכז עבודה להיינדמן ולחשמלאי
-- כולל תמחור, הצעות דיגיטליות, תשלומים, רווח ותמונות לפני/אחרי.

create extension if not exists pgcrypto;

-- משאירים vehicle רק לתאימות לנתונים ישנים; הוא אינו מוצג עוד בממשק.
alter table public.requests drop constraint if exists requests_category_check;
alter table public.requests add constraint requests_category_check
  check (category in ('vehicle','air_conditioning','home','handyman','electrician'));

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
    when 'handyman' then 'היינדמן'
    when 'electrician' then 'חשמלאי'
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
      or (new.category='handyman' and 'הנדימן'=any(bp.specialties))
      or new.category::text = any(bp.specialties)
    );

  return new;
end;
$$;

create table if not exists public.professional_settings (
  professional_id uuid primary key references auth.users(id) on delete cascade,
  trade text not null default 'handyman' check (trade in ('handyman','electrician')),
  default_hourly_rate numeric(12,2) not null default 180 check (default_hourly_rate >= 0),
  default_travel_cost numeric(12,2) not null default 50 check (default_travel_cost >= 0),
  overhead_percent numeric(5,2) not null default 15 check (overhead_percent between 0 and 60),
  risk_percent numeric(5,2) not null default 15 check (risk_percent between 0 and 60),
  payment_link text,
  quote_terms text not null default 'המחיר כפוף לכך שתיאור העבודה והתמונות שנמסרו מלאים ומדויקים. עבודה נוספת תבוצע רק לאחר אישור הלקוח.',
  electrician_license_number text,
  electrician_license_expiry date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'professional_settings_payment_link_http'
      and conrelid = 'public.professional_settings'::regclass
  ) then
    alter table public.professional_settings
      add constraint professional_settings_payment_link_http
      check (payment_link is null or payment_link ~* '^https?://');
  end if;
end $$;

create table if not exists public.pro_jobs (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid() unique,
  professional_id uuid not null references auth.users(id) on delete cascade,
  trade text not null check (trade in ('handyman','electrician')),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null check (char_length(customer_phone) between 7 and 30),
  city text,
  job_type text not null default 'general',
  description text not null check (char_length(description) between 1 and 4000),
  scheduled_at timestamptz,
  customer_questions text[] not null default '{}',
  tools_needed text[] not null default '{}',
  warnings text[] not null default '{}',
  labor_hours numeric(8,2) not null default 1 check (labor_hours > 0),
  hourly_rate numeric(12,2) not null default 0 check (hourly_rate >= 0),
  materials_cost numeric(12,2) not null default 0 check (materials_cost >= 0),
  travel_cost numeric(12,2) not null default 0 check (travel_cost >= 0),
  assistant_cost numeric(12,2) not null default 0 check (assistant_cost >= 0),
  overhead_percent numeric(5,2) not null default 0 check (overhead_percent between 0 and 60),
  risk_percent numeric(5,2) not null default 0 check (risk_percent between 0 and 60),
  price_floor numeric(12,2) not null default 0 check (price_floor >= 0),
  recommended_price numeric(12,2) not null default 0 check (recommended_price >= 0),
  quoted_price numeric(12,2) not null default 0 check (quoted_price >= 0),
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  quote_scope text,
  quote_terms text,
  status text not null default 'lead' check (status in ('lead','quoted','approved','scheduled','in_progress','completed','paid','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','deposit','paid')),
  actual_hours numeric(8,2) check (actual_hours is null or actual_hours > 0),
  actual_materials_cost numeric(12,2) check (actual_materials_cost is null or actual_materials_cost >= 0),
  actual_paid numeric(12,2) not null default 0 check (actual_paid >= 0),
  actual_profit numeric(12,2),
  actual_hourly_profit numeric(12,2),
  client_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, professional_id)
);

create index if not exists pro_jobs_professional_created_idx
  on public.pro_jobs(professional_id, created_at desc);
create index if not exists pro_jobs_professional_status_idx
  on public.pro_jobs(professional_id, status);

create table if not exists public.pro_job_media (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  professional_id uuid not null,
  storage_path text not null unique,
  phase text not null check (phase in ('before','after')),
  created_at timestamptz not null default now(),
  foreign key (job_id, professional_id)
    references public.pro_jobs(id, professional_id) on delete cascade
);

create index if not exists pro_job_media_job_idx
  on public.pro_job_media(job_id, created_at);
create index if not exists pro_job_media_job_professional_idx
  on public.pro_job_media(job_id, professional_id);

alter table public.professional_settings enable row level security;
alter table public.pro_jobs enable row level security;
alter table public.pro_job_media enable row level security;

drop policy if exists "professional_settings_select_own" on public.professional_settings;
create policy "professional_settings_select_own"
on public.professional_settings for select to authenticated
using ((select auth.uid()) = professional_id);

drop policy if exists "professional_settings_insert_own" on public.professional_settings;
create policy "professional_settings_insert_own"
on public.professional_settings for insert to authenticated
with check ((select auth.uid()) = professional_id);

drop policy if exists "professional_settings_update_own" on public.professional_settings;
create policy "professional_settings_update_own"
on public.professional_settings for update to authenticated
using ((select auth.uid()) = professional_id)
with check ((select auth.uid()) = professional_id);

drop policy if exists "pro_jobs_select_own" on public.pro_jobs;
create policy "pro_jobs_select_own"
on public.pro_jobs for select to authenticated
using ((select auth.uid()) = professional_id);

drop policy if exists "pro_jobs_insert_own" on public.pro_jobs;
create policy "pro_jobs_insert_own"
on public.pro_jobs for insert to authenticated
with check ((select auth.uid()) = professional_id);

drop policy if exists "pro_jobs_update_own" on public.pro_jobs;
create policy "pro_jobs_update_own"
on public.pro_jobs for update to authenticated
using ((select auth.uid()) = professional_id)
with check ((select auth.uid()) = professional_id);

drop policy if exists "pro_jobs_delete_own" on public.pro_jobs;
create policy "pro_jobs_delete_own"
on public.pro_jobs for delete to authenticated
using ((select auth.uid()) = professional_id);

drop policy if exists "pro_job_media_select_own" on public.pro_job_media;
create policy "pro_job_media_select_own"
on public.pro_job_media for select to authenticated
using ((select auth.uid()) = professional_id);

drop policy if exists "pro_job_media_insert_own" on public.pro_job_media;
create policy "pro_job_media_insert_own"
on public.pro_job_media for insert to authenticated
with check ((select auth.uid()) = professional_id);

drop policy if exists "pro_job_media_delete_own" on public.pro_job_media;
create policy "pro_job_media_delete_own"
on public.pro_job_media for delete to authenticated
using ((select auth.uid()) = professional_id);

grant select, insert, update on public.professional_settings to authenticated;
grant select, insert, update, delete on public.pro_jobs to authenticated;
grant select, insert, delete on public.pro_job_media to authenticated;

create or replace function public.set_mehirli_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_professional_settings_updated_at on public.professional_settings;
create trigger trg_professional_settings_updated_at
before update on public.professional_settings
for each row execute function public.set_mehirli_updated_at();

drop trigger if exists trg_pro_jobs_updated_at on public.pro_jobs;
create trigger trg_pro_jobs_updated_at
before update on public.pro_jobs
for each row execute function public.set_mehirli_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-media', 'job-media', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "job_media_storage_select_own" on storage.objects;
create policy "job_media_storage_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'job-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "job_media_storage_insert_own" on storage.objects;
create policy "job_media_storage_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "job_media_storage_update_own" on storage.objects;
create policy "job_media_storage_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'job-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'job-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "job_media_storage_delete_own" on storage.objects;
create policy "job_media_storage_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'job-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.get_public_job_quote(p_token uuid)
returns table(
  job_id uuid,
  business_name text,
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

revoke all on function public.get_public_job_quote(uuid) from public;
grant execute on function public.get_public_job_quote(uuid) to anon, authenticated;

create or replace function public.approve_public_job_quote(p_token uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.pro_jobs;
begin
  select * into v_job
  from public.pro_jobs
  where public_token = p_token
  for update;

  if v_job.id is null or v_job.status = 'cancelled' then
    raise exception 'quote_not_available';
  end if;

  if v_job.status in ('lead','quoted') then
    update public.pro_jobs
       set status = 'approved', client_approved_at = now()
     where id = v_job.id;

    insert into public.notifications(user_id, kind, title, body, data)
    values (
      v_job.professional_id,
      'direct_quote_approved',
      'הצעת המחיר אושרה',
      v_job.customer_name || ' אישר/ה את ההצעה עבור ' || left(v_job.description, 100),
      jsonb_build_object('pro_job_id', v_job.id)
    );
  end if;

  return 'approved';
end;
$$;

revoke all on function public.approve_public_job_quote(uuid) from public;
grant execute on function public.approve_public_job_quote(uuid) to anon, authenticated;

-- Legacy RPCs are for signed-in users only. Trigger functions stay internal.
revoke execute on function public.admin_dashboard_summary() from anon, authenticated, public;
revoke execute on function public.admin_list_pending_payments() from anon, authenticated, public;
revoke execute on function public.admin_list_users() from anon, authenticated, public;
revoke execute on function public.approve_payment(uuid) from anon, authenticated, public;
revoke execute on function public.reject_payment(uuid) from anon, authenticated, public;
revoke execute on function public.get_my_selected_jobs() from anon, authenticated, public;
revoke execute on function public.get_selected_contact(uuid) from anon, authenticated, public;
revoke execute on function public.select_quote(uuid) from anon, authenticated, public;
revoke execute on function public.submit_quote(uuid, text, numeric, numeric, numeric, text, text) from anon, authenticated, public;
revoke execute on function public.is_mehirli_admin() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.notify_new_quote() from anon, authenticated, public;
revoke execute on function public.notify_new_request() from anon, authenticated, public;
revoke execute on function public.notify_payment_pending() from anon, authenticated, public;
revoke execute on function public.notify_quote_selected() from anon, authenticated, public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_pending_payments() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.approve_payment(uuid) to authenticated;
grant execute on function public.reject_payment(uuid) to authenticated;
grant execute on function public.get_my_selected_jobs() to authenticated;
grant execute on function public.get_selected_contact(uuid) to authenticated;
grant execute on function public.select_quote(uuid) to authenticated;
grant execute on function public.submit_quote(uuid, text, numeric, numeric, numeric, text, text) to authenticated;
grant execute on function public.is_mehirli_admin() to authenticated;

select 'V25 professional workspace ready' as status;
