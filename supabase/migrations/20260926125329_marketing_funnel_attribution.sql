-- Keep the v113 RPC contract. Verified account milestones do not depend on checkout return.
-- Source cards combine browser activity with first-acquisition account conversions.
create or replace function public.admin_marketing_summary_v113(p_range text default 'today')
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_range text := case when p_range in ('30d','all') then p_range else 'today' end;
  v_start timestamptz := case
    when p_range = 'all' then '-infinity'::timestamptz
    when p_range = '30d' then now() - interval '30 days'
    else date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
  end;
  v_visitors bigint := 0; v_clicks bigint := 0; v_forms bigint := 0;
  v_attempts bigint := 0; v_signups bigint := 0; v_jobs bigint := 0;
  v_sends bigint := 0; v_installs bigint := 0; v_payers bigint := 0;
  v_sources jsonb := '[]'::jsonb;
  v_visit_sources jsonb := '[]'::jsonb; v_total_visits bigint := 0;
begin
  if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;

  select count(distinct visitor_id) filter (where event_name in ('page_view','landing_page_view','app_open','signup_form_open')),
         count(distinct visitor_id) filter (where event_name in ('trial_cta_click','landing_cta_click')),
         count(distinct visitor_id) filter (where event_name='signup_form_open'),
         count(distinct visitor_id) filter (where event_name='signup_attempt'),
         count(distinct visitor_id) filter (where event_name='trial_signup'),
         count(distinct visitor_id) filter (where event_name='first_job_created'),
         count(distinct visitor_id) filter (where event_name='quote_send_opened'),
         count(distinct visitor_id) filter (where event_name in ('app_installed','standalone_open')),
         count(distinct visitor_id) filter (where event_name='payment_completed')
  into v_visitors,v_clicks,v_forms,v_attempts,v_signups,v_jobs,v_sends,v_installs,v_payers
  from public.app_analytics_events e
  where e.created_at >= v_start
    and coalesce(e.source,'') <> 'customer-preview'
    and coalesce(e.campaign,'') not like 'counter_%'
    and not exists (
      select 1 from public.app_analytics_events a
      join public.admin_users au on au.user_id=a.user_id
      where a.visitor_id=e.visitor_id
    );

  select greatest(v_signups,count(*)) into v_signups
  from public.profiles s
  where s.role = 'professional' and s.created_at >= v_start
    and not exists (select 1 from public.admin_users au where au.user_id=s.id);

  select count(*) into v_jobs
  from (select professional_id,min(created_at) created_at from public.pro_jobs group by professional_id) j
  where j.created_at >= v_start
    and not exists (select 1 from public.admin_users au where au.user_id=j.professional_id);

  select count(distinct o.professional_id) into v_payers
  from public.platform_payment_orders o
  where o.status='paid' and coalesce(o.paid_at,o.updated_at,o.created_at) >= v_start
    and not exists(select 1 from public.admin_users au where au.user_id=o.professional_id);

  -- Clicks are observed clicks, never inferred from registration.

  with first_touch as (
    select distinct on (e.visitor_id) e.visitor_id,
      coalesce(nullif(e.source,''),'direct') raw_source,
      coalesce(nullif(e.campaign,''),'') campaign
    from public.app_analytics_events e
    where e.created_at >= v_start
      and e.event_name in ('page_view','landing_page_view','app_open','signup_form_open')
      and coalesce(e.source,'') <> 'customer-preview'
      and coalesce(e.campaign,'') not like 'counter_%'
      and not exists (
        select 1 from public.app_analytics_events a
        join public.admin_users au on au.user_id=a.user_id
        where a.visitor_id=e.visitor_id
      )
    order by e.visitor_id,e.created_at
  ), labelled as (
    select visitor_id,
      public.traffic_source_label_v113(raw_source) source
    from first_touch
  ), source_stats as (
    select l.source,count(*)::bigint visitors,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name in ('trial_cta_click','landing_cta_click') and x.created_at>=v_start))::bigint trial_clicks,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='signup_form_open' and x.created_at>=v_start))::bigint form_opens,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='signup_attempt' and x.created_at>=v_start))::bigint signup_attempts,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='trial_signup' and x.created_at>=v_start))::bigint trial_signups
    from labelled l group by l.source
  ), account_visitors as (
    -- Authenticated events link browser IDs to accounts; no user-supplied identity is trusted.
    select distinct user_id,visitor_id from public.app_analytics_events
    where user_id is not null
      and not exists(select 1 from public.admin_users au where au.user_id=app_analytics_events.user_id)
  ), account_sources as (
    select distinct on (a.user_id) a.user_id,
      public.traffic_source_label_v113(coalesce(nullif(e.source,''),'direct')) source
    from account_visitors a join public.app_analytics_events e on e.visitor_id=a.visitor_id
    where coalesce(e.source,'') <> 'customer-preview'
      and coalesce(e.campaign,'') not like 'counter_%'
      and not exists(select 1 from public.app_analytics_events x join public.admin_users au on au.user_id=x.user_id where x.visitor_id=e.visitor_id)
    order by a.user_id,(coalesce(e.source,'') in ('','direct','landing')),e.created_at,e.visitor_id,e.source
  ), milestones as (
    select professional_id,1::bigint first_jobs,0::bigint paying_customers
    from public.pro_jobs
    where not exists(select 1 from public.admin_users au where au.user_id=professional_id)
    group by professional_id having min(created_at)>=v_start
    union all
    select distinct professional_id,0::bigint,1::bigint from public.platform_payment_orders
    where status='paid' and coalesce(paid_at,updated_at,created_at)>=v_start
      and not exists(select 1 from public.admin_users au where au.user_id=professional_id)
  ), conversion_stats as (
    select coalesce(a.source,'ישיר / מקור לא מזוהה') source,
      sum(m.first_jobs) first_jobs,sum(m.paying_customers) paying_customers
    from milestones m left join account_sources a on a.user_id=m.professional_id
    group by 1
  ), combined as (
    select coalesce(s.source,c.source) source,coalesce(s.visitors,0) visitors,
      coalesce(s.trial_clicks,0) trial_clicks,coalesce(s.form_opens,0) form_opens,
      coalesce(s.signup_attempts,0) signup_attempts,coalesce(s.trial_signups,0) trial_signups,
      coalesce(c.first_jobs,0) first_jobs,coalesce(c.paying_customers,0) paying_customers
    from source_stats s full join conversion_stats c using(source)
  )
  select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.trial_signups desc,s.source),'[]'::jsonb)
  into v_sources from combined s;

  with counted as (
    select v.* from public.app_traffic_visits v
    where v.created_at >= v_start
      and coalesce(v.source,'') <> 'customer-preview'
      and coalesce(v.campaign,'') not like 'counter_%'
      and not exists(select 1 from public.admin_users au where au.user_id=v.user_id)
      and not exists(select 1 from public.app_analytics_events e join public.admin_users au on au.user_id=e.user_id where e.visitor_id=v.visitor_id)
  ), grouped as (
    select public.traffic_source_label_v113(source) source,count(*) visits,count(distinct visitor_id) visitors
    from counted group by 1
  ) select coalesce(sum(visits),0),coalesce(jsonb_agg(to_jsonb(g) order by visits desc),'[]'::jsonb)
    into v_total_visits,v_visit_sources from grouped g;

  return jsonb_build_object(
    'total_visits',v_total_visits,'visit_sources',v_visit_sources,
    'range',v_range,'generated_at',now(),'unique_visitors_30d',coalesce(v_visitors,0),
    'trial_clicks',coalesce(v_clicks,0),'form_opens',coalesce(v_forms,0),
    'signup_attempts',coalesce(v_attempts,0),'trial_signups',coalesce(v_signups,0),
    'first_jobs',coalesce(v_jobs,0),'quote_sends',coalesce(v_sends,0),
    'installs',coalesce(v_installs,0),'paying_customers',coalesce(v_payers,0),
    'visitor_to_click_percent',case when v_visitors>0 then round(v_clicks::numeric*100/v_visitors,1) else 0 end,
    'click_to_trial_percent',case when v_clicks>0 then round(v_signups::numeric*100/v_clicks,1) else 0 end,
    'trial_to_job_percent',case when v_signups>0 then round(v_jobs::numeric*100/v_signups,1) else 0 end,
    'trial_to_paid_percent',case when v_signups>0 then round(v_payers::numeric*100/v_signups,1) else 0 end,
    'source_breakdown',v_sources
  );
end;
$$;

revoke all on function public.admin_marketing_summary_v113(text) from public, anon, authenticated;
grant execute on function public.admin_marketing_summary_v113(text) to authenticated;
