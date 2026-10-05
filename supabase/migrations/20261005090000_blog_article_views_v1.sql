-- Anonymous, privacy-preserving article readership counts for Mehirli.
-- Apply with Supabase migration blog_article_views_v1.

create table if not exists public.blog_article_views (
  visitor_id uuid not null,
  article_slug text not null,
  view_date date not null default (timezone('Asia/Jerusalem', now()))::date,
  first_seen_at timestamptz not null default now(),
  primary key (visitor_id, article_slug, view_date),
  constraint blog_article_views_slug_check check (article_slug ~ '^[a-z0-9-]{1,100}$')
);

alter table public.blog_article_views enable row level security;
revoke all on public.blog_article_views from public, anon, authenticated;
comment on table public.blog_article_views is 'Daily unique, anonymous views by published article. Raw rows are only accessed through narrow RPC functions.';

create or replace function public.track_blog_article_view_v1(
  p_visitor_id uuid,
  p_slug text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_visitor_id is null or p_slug is null or p_slug !~ '^[a-z0-9-]{1,100}$' then
    return false;
  end if;

  if p_slug not in ('after-quote','monthly-finances','job-profit','monthly-income-expenses','quote-creation','quote-follow-up')
     and not exists (
       select 1 from public.blog_publications bp
       where bp.slug = p_slug and bp.published_at is not null
     ) then
    return false;
  end if;

  insert into public.blog_article_views (visitor_id, article_slug)
  values (p_visitor_id, p_slug)
  on conflict (visitor_id, article_slug, view_date) do nothing;

  return true;
end;
$$;

create or replace function public.admin_blog_article_views_v1(p_range text default 'today')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_range text := case when p_range in ('30d','all') then p_range else 'today' end;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_start date := case
    when p_range = 'all' then '-infinity'::date
    when p_range = '30d' then v_today - 29
    else v_today
  end;
  v_articles jsonb;
begin
  if not public.is_mehirli_admin() then
    raise exception 'not_admin';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'slug', v.article_slug,
        'title', coalesce(bp.title, case v.article_slug
          when 'after-quote' then 'אחרי שליחת הצעת המחיר: איך עוקבים אחרי העבודה והתשלום?'
          when 'monthly-finances' then 'איך לעקוב אחרי הכנסות והוצאות בעסק?'
          when 'job-profit' then 'כמה באמת נשאר מהעבודה? ארבע דוגמאות לבעלי מקצוע'
          when 'monthly-income-expenses' then 'יודעים כמה נכנס וכמה יצא החודש?'
          when 'quote-creation' then 'איך כותבים הצעת מחיר מקצועית? 5 שלבים ברורים'
          when 'quote-follow-up' then 'ההצעה נשלחה. איפה שומרים את הפרטים?'
          else v.article_slug
        end),
        'views', v.views,
        'readers', v.readers
      ) order by v.views desc, v.article_slug
    ),
    '[]'::jsonb
  )
  into v_articles
  from (
    select article_slug, count(*)::bigint as views, count(distinct visitor_id)::bigint as readers
    from public.blog_article_views
    where view_date >= v_start
    group by article_slug
  ) v
  left join public.blog_publications bp on bp.slug = v.article_slug;

  return jsonb_build_object('range',v_range,'generated_at',now(),'articles',v_articles);
end;
$$;

revoke all on function public.track_blog_article_view_v1(uuid,text) from public;
grant execute on function public.track_blog_article_view_v1(uuid,text) to anon, authenticated;
revoke all on function public.admin_blog_article_views_v1(text) from public, anon;
grant execute on function public.admin_blog_article_views_v1(text) to authenticated;
