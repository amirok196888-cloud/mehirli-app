create table if not exists public.pro_appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.pro_customers(id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text,
  appointment_at timestamptz not null,
  address text,
  title text not null check (char_length(title) between 1 and 240),
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pro_appointments_owner_date_idx
  on public.pro_appointments (professional_id, appointment_at);
create index if not exists pro_appointments_customer_idx
  on public.pro_appointments (customer_id);

alter table public.pro_appointments enable row level security;

drop policy if exists "Owners manage their appointments" on public.pro_appointments;
create policy "Owners manage their appointments"
  on public.pro_appointments
  for all
  to authenticated
  using ((select auth.uid()) = professional_id)
  with check ((select auth.uid()) = professional_id);

revoke all on table public.pro_appointments from anon;
grant select, insert, update, delete on table public.pro_appointments to authenticated;
