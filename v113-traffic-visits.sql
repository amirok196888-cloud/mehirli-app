-- Anonymous ingestion is write-only; analytics are readable only by verified admins.
create table public.app_traffic_visits (
 visit_id uuid primary key,
 visitor_id uuid not null,
 user_id uuid references auth.users(id) on delete set null,
 source text not null,
 campaign text,
 created_at timestamptz not null default now()
);
alter table public.app_traffic_visits enable row level security;
revoke all on public.app_traffic_visits from public,anon,authenticated;
create index app_traffic_visits_created_idx on public.app_traffic_visits(created_at desc);
create index app_traffic_visits_visitor_idx on public.app_traffic_visits(visitor_id);

create function public.track_visit_v113(p_visit_id uuid,p_visitor_id uuid,p_source text default 'direct',p_campaign text default null)
returns boolean language plpgsql security definer set search_path='public','pg_temp' as $$
begin
 if p_visit_id is null or p_visitor_id is null then return false; end if;
 if auth.uid() is not null and exists(select 1 from public.admin_users where user_id=auth.uid()) then return false; end if;
 if exists(select 1 from public.app_analytics_events e join public.admin_users a on a.user_id=e.user_id where e.visitor_id=p_visitor_id) then return false; end if;
 insert into public.app_traffic_visits(visit_id,visitor_id,user_id,source,campaign)
 values(p_visit_id,p_visitor_id,auth.uid(),coalesce(nullif(left(regexp_replace(coalesce(p_source,''),'[^[:alnum:]_.-]','','g'),80),''),'direct'),nullif(left(regexp_replace(coalesce(p_campaign,''),'[^[:alnum:]_.-]','','g'),100),''))
 on conflict(visit_id) do nothing;
 return true;
end; $$;
revoke all on function public.track_visit_v113(uuid,uuid,text,text) from public;
grant execute on function public.track_visit_v113(uuid,uuid,text,text) to anon,authenticated;

create function public.traffic_source_label_v113(s text)
returns text language sql immutable security invoker set search_path='public','pg_temp' as $$
 select case
 when s='google_paid' then 'גוגל — ממומן'
 when s='google_organic' or s ~ '^google\.[a-z.]+$' then 'גוגל — חיפוש אורגני'
 when s in ('google','google_unknown') then 'גוגל — סוג תנועה לא מזוהה'
 when s='facebook_paid' then 'פייסבוק — ממומן'
 when s='instagram_paid' then 'אינסטגרם — ממומן'
 when s='meta_paid' then 'פייסבוק / אינסטגרם — סיווג ממומן קודם'
 when s in ('facebook_organic','facebook_groups') then 'פייסבוק — אורגני / קבוצות'
 when s in ('fb','facebook','facebook_unknown','facebook.com','m.facebook.com','l.facebook.com','lm.facebook.com') then 'פייסבוק — סוג תנועה לא מזוהה'
 when s='instagram_organic' then 'אינסטגרם — אורגני'
 when s in ('ig','instagram','instagram_unknown','instagram.com','l.instagram.com') then 'אינסטגרם — סוג תנועה לא מזוהה'
 when s='tiktok_paid' then 'טיקטוק — ממומן'
 when s='tiktok_organic' then 'טיקטוק — אורגני'
 when s='tiktok' then 'טיקטוק — סוג תנועה לא מזוהה'
 when s='whatsapp' then 'וואטסאפ'
 when coalesce(s,'') in ('','direct','landing') then 'ישיר / מקור לא מזוהה'
 else s end
$$;
revoke all on function public.traffic_source_label_v113(text) from public,anon,authenticated;

-- V87: selectable live marketing funnel (today or 30 days).
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
      public.traffic_source_label_v113(raw_source) source
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
