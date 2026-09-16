-- V49: reliable campaign attribution and a complete marketing funnel.

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
    'page_view','app_installed','standalone_open','account_active',
    'trial_cta_click','trial_signup','trial_activated',
    'payment_started','payment_completed'
  ) then
    return false;
  end if;

  v_source := nullif(left(regexp_replace(coalesce(p_source,''), '[^[:alnum:]_.-]', '', 'g'), 80), '');
  v_campaign := nullif(left(regexp_replace(coalesce(p_campaign,''), '[^[:alnum:]_.-]', '', 'g'), 100), '');

  insert into public.app_analytics_events(visitor_id, user_id, event_name, source, campaign)
  values (p_visitor_id, auth.uid(), p_event_name, v_source, v_campaign)
  on conflict (visitor_id, event_name, event_day) do update
    set user_id = coalesce(excluded.user_id, public.app_analytics_events.user_id),
        source = coalesce(public.app_analytics_events.source, excluded.source),
        campaign = coalesce(public.app_analytics_events.campaign, excluded.campaign);
  return true;
end;
$$;

create or replace function public.admin_marketing_summary_v49()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_window_start timestamptz;
  v_visitors bigint := 0;
  v_clicks bigint := 0;
  v_trials bigint := 0;
  v_installs bigint := 0;
  v_payers bigint := 0;
  v_sources jsonb := '[]'::jsonb;
begin
  if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;

  select greatest(
    now() - interval '30 days',
    coalesce(min(created_at), now() - interval '30 days')
  ) into v_window_start
  from public.app_analytics_events
  where event_name = 'page_view';

  select count(distinct e.visitor_id) into v_visitors
  from public.app_analytics_events e
  where e.event_name = 'page_view'
    and e.created_at >= v_window_start
    and coalesce(e.source,'') <> 'customer-preview'
    and not exists (
      select 1
      from public.app_analytics_events a
      join public.admin_users au on au.user_id = a.user_id
      where a.visitor_id = e.visitor_id
    );

  select count(distinct e.visitor_id) into v_clicks
  from public.app_analytics_events e
  where e.event_name = 'trial_cta_click'
    and e.created_at >= v_window_start
    and not exists (
      select 1
      from public.app_analytics_events a
      join public.admin_users au on au.user_id = a.user_id
      where a.visitor_id = e.visitor_id
    );

  select count(*) into v_trials
  from public.profiles p
  where p.created_at >= v_window_start
    and not exists (select 1 from public.admin_users au where au.user_id = p.id);

  -- A completed signup necessarily included a click, including the signup that
  -- happened before V49 began saving the click event.
  v_clicks := greatest(v_clicks, v_trials);

  select count(distinct e.visitor_id) into v_installs
  from public.app_analytics_events e
  where e.event_name in ('app_installed','standalone_open')
    and e.created_at >= v_window_start
    and not exists (
      select 1
      from public.app_analytics_events a
      join public.admin_users au on au.user_id = a.user_id
      where a.visitor_id = e.visitor_id
    );

  select count(distinct o.professional_id) into v_payers
  from public.platform_payment_orders o
  where o.status = 'paid' and coalesce(o.paid_at,o.updated_at,o.created_at) >= v_window_start;

  with first_visit as (
    select distinct on (e.visitor_id)
      e.visitor_id,
      coalesce(nullif(e.source,''),'direct') as raw_source,
      coalesce(nullif(e.campaign,''),'') as campaign
    from public.app_analytics_events e
    where e.event_name = 'page_view'
      and e.created_at >= v_window_start
      and coalesce(e.source,'') <> 'customer-preview'
      and not exists (
        select 1
        from public.app_analytics_events a
        join public.admin_users au on au.user_id = a.user_id
        where a.visitor_id = e.visitor_id
      )
    order by e.visitor_id, e.created_at
  ), labelled as (
    select visitor_id,
      case
        when campaign <> '' and raw_source in ('fb','ig','meta_paid','facebook','instagram')
          then 'קמפיין Meta · ' || campaign
        when raw_source = 'meta_paid' then 'קמפיין Meta ממומן'
        when raw_source = 'facebook_groups' then 'פייסבוק — פרסום בקבוצות'
        when raw_source in ('fb','facebook','facebook_organic','facebook.com','m.facebook.com','l.facebook.com','lm.facebook.com')
          then 'פייסבוק — כניסה רגילה'
        when raw_source in ('ig','instagram','instagram_organic','instagram.com','l.instagram.com')
          then 'אינסטגרם — כניסה רגילה'
        when raw_source = 'trade_sites' then 'אתרי בעלי מקצוע'
        when raw_source = 'whatsapp' then 'WhatsApp'
        when raw_source = 'amirok196888-cloud.github.io' then 'מעבר פנימי — מקור ישן לא נשמר'
        when raw_source = 'direct' then 'קישור ישיר / מקור לא מזוהה'
        else raw_source
      end as source
    from first_visit
  ), source_stats as (
    select
      l.source,
      count(*)::bigint as visitors,
      count(*) filter (where exists (
        select 1 from public.app_analytics_events x
        where x.visitor_id=l.visitor_id and x.event_name='trial_cta_click' and x.created_at>=v_window_start
      ))::bigint as trial_clicks,
      count(*) filter (where exists (
        select 1 from public.app_analytics_events x
        where x.visitor_id=l.visitor_id and x.event_name='trial_signup' and x.created_at>=v_window_start
      ))::bigint as trial_signups,
      count(*) filter (where exists (
        select 1 from public.app_analytics_events x
        where x.visitor_id=l.visitor_id and x.event_name='payment_completed' and x.created_at>=v_window_start
      ))::bigint as paying_customers
    from labelled l
    group by l.source
  ), attributed as (
    select
      coalesce(sum(trial_clicks),0)::bigint as clicks,
      coalesce(sum(trial_signups),0)::bigint as signups,
      coalesce(sum(paying_customers),0)::bigint as payers
    from source_stats
  ), all_rows as (
    select source, visitors, trial_clicks, trial_signups, paying_customers
    from source_stats
    union all
    select
      'הרשמה ללא שיוך — לפני תיקון המדידה',
      0::bigint,
      greatest(v_clicks-a.clicks,0)::bigint,
      greatest(v_trials-a.signups,0)::bigint,
      greatest(v_payers-a.payers,0)::bigint
    from attributed a
    where greatest(v_clicks-a.clicks,0) > 0
       or greatest(v_trials-a.signups,0) > 0
       or greatest(v_payers-a.payers,0) > 0
  )
  select coalesce(
    jsonb_agg(to_jsonb(s) order by s.visitors desc, s.trial_signups desc),
    '[]'::jsonb
  ) into v_sources
  from all_rows s;

  return jsonb_build_object(
    'window_started_at', v_window_start,
    'unique_visitors', coalesce(v_visitors,0),
    'unique_visitors_30d', coalesce(v_visitors,0),
    'trial_clicks', coalesce(v_clicks,0),
    'trial_signups', coalesce(v_trials,0),
    'installs', coalesce(v_installs,0),
    'paying_customers', coalesce(v_payers,0),
    'visitor_to_click_percent', case when v_visitors > 0 then round(v_clicks::numeric * 100 / v_visitors, 1) else 0 end,
    'click_to_trial_percent', case when v_clicks > 0 then round(v_trials::numeric * 100 / v_clicks, 1) else 0 end,
    'trial_to_paid_percent', case when v_trials > 0 then round(v_payers::numeric * 100 / v_trials, 1) else 0 end,
    'source_breakdown', v_sources
  );
end;
$$;

revoke all on function public.admin_marketing_summary_v49() from public;
grant execute on function public.admin_marketing_summary_v49() to authenticated;

