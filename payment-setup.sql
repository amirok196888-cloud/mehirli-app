-- מחירלי: בקשות תשלום ואישור ידני של PayBox
-- להריץ פעם אחת ב-Supabase > SQL Editor

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null default 15 check (amount > 0),
  credits integer not null default 3 check (credits > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);

alter table public.admin_users enable row level security;
alter table public.payment_requests enable row level security;

drop policy if exists "admin can see self" on public.admin_users;
create policy "admin can see self" on public.admin_users
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "users create own payment request" on public.payment_requests;
create policy "users create own payment request" on public.payment_requests
for insert to authenticated
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "users read own payment requests" on public.payment_requests;
create policy "users read own payment requests" on public.payment_requests
for select to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

grant select on public.admin_users to authenticated;
grant select, insert on public.payment_requests to authenticated;

create or replace function public.approve_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.payment_requests;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;

  select * into p from public.payment_requests
  where id = p_payment_id
  for update;

  if p.id is null then raise exception 'payment_not_found'; end if;
  if p.status <> 'pending' then raise exception 'payment_already_processed'; end if;

  insert into public.credits(user_id,balance)
  values (p.user_id,p.credits)
  on conflict (user_id) do update
    set balance = public.credits.balance + excluded.balance;

  insert into public.credit_transactions(user_id,amount,reason)
  values (p.user_id,p.credits,'PayBox payment approved');

  update public.payment_requests
  set status='approved', approved_at=now(), approved_by=auth.uid()
  where id=p.id;
end;
$$;

grant execute on function public.approve_payment(uuid) to authenticated;

-- לאחר ההרצה: הוסף את עצמך כמנהל דרך Authentication > Users,
-- העתק את ה-UUID שלך והרץ:
-- insert into public.admin_users(user_id) values ('YOUR-USER-UUID') on conflict do nothing;
