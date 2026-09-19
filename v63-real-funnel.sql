-- V63: measure the real journey from landing page to first customer quote.

alter table public.app_analytics_events
  drop constraint if exists app_analytics_events_event_name_check;
alter table public.app_analytics_events
  add constraint app_analytics_events_event_name_check check (event_name in (
    'page_view','landing_page_view','landing_cta_click','signup_form_open',
    'signup_attempt','trial_signup','trial_activated','app_open','account_active',
    'first_job_created','quote_send_opened','app_installed','standalone_open',
    'payment_started','payment_completed'
  ));

create or replace function public.track_app_event_v40(
  p_visitor_id uuid,
  p_event_name text,
  p_source text default null,
  p_campaign text default null
)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_source text;
  v_campaign text;
begin
  if p_visitor_id is null then return false; end if;
  if p_event_name not in (
    'page_view','landing_page_view','landing_cta_click','signup_form_open',
    'signup_attempt','trial_signup','trial_activated','app_open',
    'account_active','first_job_created','quote_send_opened',
    'app_installed','standalone_open','payment_started','payment_completed'
  ) then return false; end if;

  v_source := nullif(left(regexp_replace(coalesce(p_source,''), '[^[:alnum:]_.-]', '', 'g'), 80), '');
  v_campaign := nullif(left(regexp_replace(coalesce(p_campaign,''), '[^[:alnum:]_.-]', '', 'g'), 100), '');

  insert into public.app_analytics_events(visitor_id,user_id,event_name,source,campaign)
  values (p_visitor_id,auth.uid(),p_event_name,v_source,v_campaign)
  on conflict (visitor_id,event_name,event_day) do update
  set user_id=coalesce(excluded.user_id,public.app_analytics_events.user_id),
      source=coalesce(public.app_analytics_events.source,excluded.source),
      campaign=coalesce(public.app_analytics_events.campaign,excluded.campaign);
  return true;
end;
$$;

revoke all on function public.track_app_event_v40(uuid,text,text,text) from public;
grant execute on function public.track_app_event_v40(uuid,text,text,text) to anon, authenticated;

create or replace function public.admin_marketing_summary_v63()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_start timestamptz := now()-interval '30 days';
  v_visitors bigint := 0; v_clicks bigint := 0; v_forms bigint := 0;
  v_attempts bigint := 0; v_signups bigint := 0; v_jobs bigint := 0;
  v_sends bigint := 0; v_installs bigint := 0; v_payers bigint := 0;
  v_sources jsonb := '[]'::jsonb;
begin
  if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;

  select count(distinct visitor_id) filter (where event_name='landing_page_view'),
         count(distinct visitor_id) filter (where event_name='landing_cta_click'),
         count(distinct visitor_id) filter (where event_name='signup_form_open'),
         count(distinct visitor_id) filter (where event_name='signup_attempt'),
         count(distinct visitor_id) filter (where event_name='trial_signup'),
         count(distinct visitor_id) filter (where event_name='first_job_created'),
         count(distinct visitor_id) filter (where event_name='quote_send_opened'),
         count(distinct visitor_id) filter (where event_name in ('app_installed','standalone_open')),
         count(distinct visitor_id) filter (where event_name='payment_completed')
  into v_visitors,v_clicks,v_forms,v_attempts,v_signups,v_jobs,v_sends,v_installs,v_payers
  from public.app_analytics_events e
  where e.created_at>=v_start
    and coalesce(e.source,'')<>'customer-preview'
    and not exists (
      select 1 from public.app_analytics_events a
      join public.admin_users au on au.user_id=a.user_id
      where a.visitor_id=e.visitor_id
    );

  with first_visit as (
    select distinct on (e.visitor_id) e.visitor_id,
      coalesce(nullif(e.source,''),'direct') raw_source,
      coalesce(nullif(e.campaign,''),'') campaign
    from public.app_analytics_events e
    where e.event_name='landing_page_view' and e.created_at>=v_start
      and not exists (select 1 from public.app_analytics_events a join public.admin_users au on au.user_id=a.user_id where a.visitor_id=e.visitor_id)
    order by e.visitor_id,e.created_at
  ), labelled as (
    select visitor_id,
      case
        when raw_source='meta_paid' then 'Meta ממומן'
        when raw_source='tiktok_paid' then 'TikTok ממומן'
        when raw_source='tiktok_organic' then 'TikTok אורגני'
        when raw_source='facebook_organic' then 'פייסבוק אורגני'
        when raw_source='instagram_organic' then 'אינסטגרם אורגני'
        when raw_source='whatsapp' then 'WhatsApp'
        when raw_source='direct' then 'קישור ישיר / לא מזוהה'
        else raw_source
      end source
    from first_visit
  )
  select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc),'[]'::jsonb) into v_sources
  from (
    select l.source,count(*)::bigint visitors,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='landing_cta_click' and x.created_at>=v_start))::bigint trial_clicks,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='trial_signup' and x.created_at>=v_start))::bigint trial_signups,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='payment_completed' and x.created_at>=v_start))::bigint paying_customers
    from labelled l group by l.source
  ) s;

  return jsonb_build_object(
    'unique_visitors_30d',coalesce(v_visitors,0),'trial_clicks',coalesce(v_clicks,0),
    'form_opens',coalesce(v_forms,0),'signup_attempts',coalesce(v_attempts,0),
    'trial_signups',coalesce(v_signups,0),'first_jobs',coalesce(v_jobs,0),
    'quote_sends',coalesce(v_sends,0),'installs',coalesce(v_installs,0),
    'paying_customers',coalesce(v_payers,0),
    'visitor_to_click_percent',case when v_visitors>0 then round(v_clicks::numeric*100/v_visitors,1) else 0 end,
    'click_to_trial_percent',case when v_clicks>0 then round(v_signups::numeric*100/v_clicks,1) else 0 end,
    'trial_to_job_percent',case when v_signups>0 then round(v_jobs::numeric*100/v_signups,1) else 0 end,
    'trial_to_paid_percent',case when v_signups>0 then round(v_payers::numeric*100/v_signups,1) else 0 end,
    'source_breakdown',v_sources
  );
end;
$$;

revoke all on function public.admin_marketing_summary_v63() from public, anon, authenticated;
grant execute on function public.admin_marketing_summary_v63() to authenticated;
