-- מחירלי V12: מנהל, משתמשים ותשלומי PayBox
-- להריץ ב-Supabase > SQL Editor פעם אחת.

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
create policy "admin can see self" on public.admin_users for select to authenticated using (user_id=auth.uid());

drop policy if exists "users create own payment request" on public.payment_requests;
create policy "users create own payment request" on public.payment_requests for insert to authenticated
with check (user_id=auth.uid() and status='pending');

drop policy if exists "users read own payment requests" on public.payment_requests;
create policy "users read own payment requests" on public.payment_requests for select to authenticated
using (user_id=auth.uid() or exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

grant select on public.admin_users to authenticated;
grant select,insert on public.payment_requests to authenticated;

create or replace function public.is_mehirli_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid());
$$;
grant execute on function public.is_mehirli_admin() to authenticated;

create or replace function public.approve_payment(p_payment_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare p public.payment_requests;
begin
 if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;
 select * into p from public.payment_requests where id=p_payment_id for update;
 if p.id is null then raise exception 'payment_not_found'; end if;
 if p.status<>'pending' then raise exception 'payment_already_processed'; end if;
 insert into public.credits(user_id,balance) values(p.user_id,p.credits)
 on conflict(user_id) do update set balance=public.credits.balance+excluded.balance;
 insert into public.credit_transactions(user_id,amount,reason) values(p.user_id,p.credits,'PayBox payment approved');
 update public.payment_requests set status='approved',approved_at=now(),approved_by=auth.uid() where id=p.id;
end;$$;
grant execute on function public.approve_payment(uuid) to authenticated;

create or replace function public.reject_payment(p_payment_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;
 update public.payment_requests set status='rejected',approved_at=now(),approved_by=auth.uid()
 where id=p_payment_id and status='pending';
end;$$;
grant execute on function public.reject_payment(uuid) to authenticated;

create or replace function public.admin_dashboard_summary()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare r jsonb;
begin
 if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;
 select jsonb_build_object(
   'users',(select count(*) from auth.users),
   'customers',(select count(*) from public.profiles where coalesce(role,'customer')<>'professional'),
   'professionals',(select count(*) from public.profiles where role='professional'),
   'pending_payments',(select count(*) from public.payment_requests where status='pending')
 ) into r;
 return r;
end;$$;
grant execute on function public.admin_dashboard_summary() to authenticated;

create or replace function public.admin_list_users()
returns table(user_id uuid,email text,role text,display_name text,business_name text,credit_balance integer)
language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;
 return query
 select u.id,u.email::text,coalesce(p.role,'customer')::text,
        coalesce(u.raw_user_meta_data->>'full_name','')::text,
        coalesce(b.business_name,'')::text,
        coalesce(c.balance,0)::integer
 from auth.users u
 left join public.profiles p on p.id=u.id
 left join public.business_profiles b on b.user_id=u.id
 left join public.credits c on c.user_id=u.id
 order by u.created_at desc;
end;$$;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_list_pending_payments()
returns table(payment_id uuid,user_id uuid,email text,display_name text,amount integer,credits integer,created_at timestamptz)
language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;
 return query
 select pr.id,u.id,u.email::text,coalesce(u.raw_user_meta_data->>'full_name',b.business_name,'')::text,
        pr.amount,pr.credits,pr.created_at
 from public.payment_requests pr
 join auth.users u on u.id=pr.user_id
 left join public.business_profiles b on b.user_id=u.id
 where pr.status='pending'
 order by pr.created_at asc;
end;$$;
grant execute on function public.admin_list_pending_payments() to authenticated;

-- שלב אחרון אחרי ההרצה:
-- Supabase > Authentication > Users > לחץ על המשתמש שלך והעתק את ה-UUID.
-- החלף YOUR-USER-UUID בשורה הבאה והריץ אותה פעם אחת:
-- insert into public.admin_users(user_id) values ('YOUR-USER-UUID') on conflict do nothing;
