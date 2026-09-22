-- V87: selectable live marketing funnel (today or 30 days).
create or replace function public.admin_marketing_summary_v87(p_range text default 'today')
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_range text := case when p_range = '30d' then '30d' else 'today' end;
  v_start timestamptz := case
    when p_range = '30d' then now() - interval '30 days'
    else date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
  end;
  v_visitors bigint := 0; v_clicks bigint := 0; v_forms bigint := 0;
  v_attempts bigint := 0; v_signups bigint := 0; v_jobs bigint := 0;
  v_sends bigint := 0; v_installs bigint := 0; v_payers bigint := 0;
  v_sources jsonb := '[]'::jsonb;
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
  from public.professional_subscriptions s
  where s.trial_started_at >= v_start
    and not exists (select 1 from public.admin_users au where au.user_id=s.professional_id);

  select greatest(v_jobs,count(distinct j.professional_id)) into v_jobs
  from public.pro_jobs j
  where j.created_at >= v_start
    and not exists (select 1 from public.admin_users au where au.user_id=j.professional_id);

  select greatest(v_payers,count(distinct o.professional_id)) into v_payers
  from public.platform_payment_orders o
  where o.status='paid' and coalesce(o.paid_at,o.updated_at,o.created_at) >= v_start;

  v_clicks := greatest(v_clicks,v_signups);

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
      case
        when campaign <> '' and raw_source in ('fb','ig','meta_paid','facebook','instagram') then 'Meta ממומן · ' || campaign
        when raw_source='meta_paid' then 'Meta ממומן'
        when raw_source in ('fb','facebook','facebook_organic','facebook.com','m.facebook.com','l.facebook.com','lm.facebook.com') then 'פייסבוק אורגני / ויראלי'
        when raw_source in ('ig','instagram','instagram_organic','instagram.com','l.instagram.com') then 'אינסטגרם אורגני'
        when raw_source='facebook_groups' then 'פייסבוק — קבוצות'
        when raw_source='tiktok_paid' then 'TikTok ממומן'
        when raw_source='tiktok_organic' then 'TikTok אורגני'
        when raw_source='whatsapp' then 'WhatsApp'
        when raw_source in ('direct','landing') then 'קישור ישיר / לא מזוהה'
        else raw_source
      end source
    from first_touch
  ), source_stats as (
    select l.source,count(*)::bigint visitors,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name in ('trial_cta_click','landing_cta_click') and x.created_at>=v_start))::bigint trial_clicks,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='signup_form_open' and x.created_at>=v_start))::bigint form_opens,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='signup_attempt' and x.created_at>=v_start))::bigint signup_attempts,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='trial_signup' and x.created_at>=v_start))::bigint trial_signups,
      count(*) filter(where exists(select 1 from public.app_analytics_events x where x.visitor_id=l.visitor_id and x.event_name='payment_completed' and x.created_at>=v_start))::bigint paying_customers
    from labelled l group by l.source
  )
  select coalesce(jsonb_agg(to_jsonb(s) order by s.visitors desc,s.trial_signups desc),'[]'::jsonb)
  into v_sources from source_stats s;

  return jsonb_build_object(
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

revoke all on function public.admin_marketing_summary_v87(text) from public, anon, authenticated;
grant execute on function public.admin_marketing_summary_v87(text) to authenticated;
