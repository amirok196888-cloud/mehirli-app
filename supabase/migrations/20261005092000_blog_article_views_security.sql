-- Harden article view ingestion with column-level INSERT, RLS, and an invoker RPC.
-- Raw view rows remain unavailable to browser clients.

drop policy if exists blog_article_views_track_insert on public.blog_article_views;
create policy blog_article_views_track_insert
on public.blog_article_views
for insert to anon, authenticated
with check (
  view_date = (timezone('Asia/Jerusalem', now()))::date
  and (
    article_slug in ('after-quote','monthly-finances','job-profit','monthly-income-expenses','quote-creation','quote-follow-up')
    or exists (
      select 1 from public.blog_publications bp
      where bp.slug = article_slug and bp.published_at is not null
    )
  )
);

grant insert (visitor_id, article_slug) on public.blog_article_views to anon, authenticated;

create or replace function public.track_blog_article_view_v1(p_visitor_id uuid, p_slug text)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_visitor_id is null or p_slug is null or p_slug !~ '^[a-z0-9-]{1,100}$' then return false; end if;
  if p_slug not in ('after-quote','monthly-finances','job-profit','monthly-income-expenses','quote-creation','quote-follow-up')
     and not exists (select 1 from public.blog_publications bp where bp.slug=p_slug and bp.published_at is not null) then
    return false;
  end if;
  insert into public.blog_article_views(visitor_id,article_slug) values(p_visitor_id,p_slug)
  on conflict do nothing;
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
  v_start date := case when p_range='all' then '-infinity'::date when p_range='30d' then v_today-29 else v_today end;
  v_articles jsonb;
begin
  if not public.is_mehirli_admin() then raise exception 'not_admin'; end if;
  with static_articles(slug,title) as (
    values
      ('after-quote','אחרי שליחת הצעת המחיר: איך עוקבים אחרי העבודה והתשלום?'),
      ('monthly-finances','איך לעקוב אחרי הכנסות והוצאות בעסק?'),
      ('job-profit','כמה באמת נשאר מהעבודה? ארבע דוגמאות לבעלי מקצוע'),
      ('monthly-income-expenses','יודעים כמה נכנס וכמה יצא החודש?'),
      ('quote-creation','איך כותבים הצעת מחיר מקצועית? 5 שלבים ברורים'),
      ('quote-follow-up','ההצעה נשלחה. איפה שומרים את הפרטים?')
  ),
  catalog as (
    select bp.slug,bp.title from public.blog_publications bp where bp.published_at is not null
    union all
    select s.slug,s.title from static_articles s
    where not exists(select 1 from public.blog_publications bp where bp.slug=s.slug and bp.published_at is not null)
  ),
  counts as (
    select article_slug,count(*)::bigint as views,count(distinct visitor_id)::bigint as readers
    from public.blog_article_views where view_date>=v_start group by article_slug
  )
  select coalesce(jsonb_agg(jsonb_build_object('slug',c.slug,'title',c.title,'views',coalesce(v.views,0),'readers',coalesce(v.readers,0))
      order by coalesce(v.views,0) desc,c.title),'[]'::jsonb)
    into v_articles
  from catalog c left join counts v on v.article_slug=c.slug;
  return jsonb_build_object('range',v_range,'generated_at',now(),'articles',v_articles);
end;
$$;
revoke all on function public.track_blog_article_view_v1(uuid,text) from public;
grant execute on function public.track_blog_article_view_v1(uuid,text) to anon,authenticated;
revoke all on function public.admin_blog_article_views_v1(text) from public,anon;
grant execute on function public.admin_blog_article_views_v1(text) to authenticated;
