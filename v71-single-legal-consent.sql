-- Mehirli V71: keep one legal consent during signup and accept the current document version.

create or replace function public.accept_legal_terms_v40(
  p_document_version text,
  p_accepted_via text default 'app'
)
returns timestamptz
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_accepted_at timestamptz;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_document_version <> '2026-09-15-v2' then raise exception 'invalid_terms_version'; end if;
  if p_accepted_via not in ('signup','app') then raise exception 'invalid_acceptance_source'; end if;

  insert into public.legal_consents(user_id, document_version, accepted_via)
  values (v_user, p_document_version, p_accepted_via)
  on conflict (user_id, document_version) do nothing;

  select accepted_at into v_accepted_at
  from public.legal_consents
  where user_id = v_user and document_version = p_document_version;
  return v_accepted_at;
end;
$$;

revoke all on function public.accept_legal_terms_v40(text, text) from public, anon, authenticated;
grant execute on function public.accept_legal_terms_v40(text, text) to authenticated;

-- Repair signups that already checked the box while the database still expected v1.
insert into public.legal_consents(user_id, document_version, accepted_via)
select u.id, '2026-09-15-v2', 'signup'
from auth.users u
where u.raw_user_meta_data ->> 'legal_version' = '2026-09-15-v2'
  and u.raw_user_meta_data ->> 'legal_accepted_at' is not null
on conflict (user_id, document_version) do nothing;
