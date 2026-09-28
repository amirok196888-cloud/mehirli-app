-- Dismissing the first-quote invitation is optional and persists per account.
alter table public.professional_onboarding_progress add column if not exists quote_welcome_dismissed_at timestamptz;
create or replace function public.dismiss_my_quote_welcome_v130() returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and role='professional') then raise exception 'not_professional'; end if;
 insert into public.professional_onboarding_progress(professional_id,registered_at,quote_welcome_dismissed_at)
 select id,coalesce(created_at,now()),now() from public.profiles where id=auth.uid()
 on conflict(professional_id) do update set quote_welcome_dismissed_at=coalesce(public.professional_onboarding_progress.quote_welcome_dismissed_at,now()),updated_at=now();
end; $$;
revoke all on function public.dismiss_my_quote_welcome_v130() from public,anon;
grant execute on function public.dismiss_my_quote_welcome_v130() to authenticated;
