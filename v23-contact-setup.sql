-- מחירלי V23: בחירת הצעה + פתיחת פרטי קשר מאובטחת
alter table public.requests add column if not exists selected_quote_id uuid;
alter table public.requests add column if not exists selected_at timestamptz;

create or replace function public.select_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_customer_id uuid;
begin
  select q.request_id into v_request_id from public.quotes q where q.id=p_quote_id;
  if v_request_id is null then raise exception 'Quote not found'; end if;

  select r.customer_id into v_customer_id from public.requests r where r.id=v_request_id;
  if v_customer_id <> auth.uid() then raise exception 'Not allowed'; end if;

  update public.requests
     set selected_quote_id=p_quote_id, selected_at=now(), status='closed'
   where id=v_request_id and selected_quote_id is null;

  if not found then raise exception 'A quote was already selected'; end if;
end $$;

grant execute on function public.select_quote(uuid) to authenticated;

create or replace function public.get_selected_contact(p_request_id uuid)
returns table(
  business_name text,
  professional_phone text,
  customer_name text,
  customer_phone text
)
language sql
security definer
set search_path = public
as $$
  select
    bp.business_name,
    bp.business_phone,
    cp.full_name,
    cp.phone
  from public.requests r
  join public.quotes q on q.id=r.selected_quote_id
  left join public.business_profiles bp on bp.user_id=q.professional_id
  left join public.profiles cp on cp.id=r.customer_id
  where r.id=p_request_id
    and r.selected_quote_id is not null
    and (auth.uid()=r.customer_id or auth.uid()=q.professional_id);
$$;
grant execute on function public.get_selected_contact(uuid) to authenticated;

create or replace function public.get_my_selected_jobs()
returns table(
  request_id uuid,
  category text,
  description text,
  city text,
  desired_timing text,
  customer_name text,
  customer_phone text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id, r.category::text, r.description, r.city, r.desired_timing,
    p.full_name, p.phone
  from public.requests r
  join public.quotes q on q.id=r.selected_quote_id
  left join public.profiles p on p.id=r.customer_id
  where q.professional_id=auth.uid()
  order by r.selected_at desc nulls last;
$$;
grant execute on function public.get_my_selected_jobs() to authenticated;
