-- V32 — secure admin deletion actions for the business-only workspace.

create or replace function public.admin_delete_pro_job_v32(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  deleted_count integer;
begin
  if not public.is_mehirli_admin() then
    raise exception 'not_admin';
  end if;

  delete from public.pro_jobs
  where id = p_job_id;

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

create or replace function public.admin_delete_business_v32(p_professional_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  deleted_count integer;
begin
  if not public.is_mehirli_admin() then
    raise exception 'not_admin';
  end if;

  if p_professional_id = auth.uid() then
    raise exception 'cannot_delete_self';
  end if;

  if exists (
    select 1 from public.admin_users
    where user_id = p_professional_id
  ) then
    raise exception 'cannot_delete_admin';
  end if;

  delete from auth.users
  where id = p_professional_id
    and (
      exists (select 1 from public.profiles p where p.id = p_professional_id and p.role = 'professional')
      or exists (select 1 from public.business_profiles bp where bp.user_id = p_professional_id)
      or exists (select 1 from public.professional_settings ps where ps.professional_id = p_professional_id)
    );

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.admin_delete_pro_job_v32(uuid) from public, anon;
revoke all on function public.admin_delete_business_v32(uuid) from public, anon;
grant execute on function public.admin_delete_pro_job_v32(uuid) to authenticated;
grant execute on function public.admin_delete_business_v32(uuid) to authenticated;

