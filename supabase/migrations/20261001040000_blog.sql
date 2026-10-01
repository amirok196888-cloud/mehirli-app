create table public.blog_drafts (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
 title text not null check (length(title) between 1 and 180),
 excerpt text not null default '' check (length(excerpt) <= 350),
 content text not null default '' check (length(content) <= 100000),
 author text not null default 'מערכת מחירלי' check (length(author) <= 100),
 updated_at timestamptz not null default now()
);
create table public.blog_publications (
 id uuid primary key references public.blog_drafts(id),
 slug text not null unique,
 title text not null,
 excerpt text not null,
 content text not null,
 author text not null,
 published_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.blog_drafts enable row level security;
alter table public.blog_publications enable row level security;
revoke all on public.blog_drafts, public.blog_publications from anon, authenticated;
grant select, insert, update on public.blog_drafts to authenticated;
grant select on public.blog_publications to anon, authenticated;
grant insert, update, delete on public.blog_publications to authenticated;
create policy blog_drafts_admin on public.blog_drafts for all to authenticated
 using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
 with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy blog_public_read on public.blog_publications for select to anon, authenticated using (true);
create policy blog_public_admin on public.blog_publications for all to authenticated
 using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
 with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create function public.publish_blog_article(article_id uuid) returns void
 language plpgsql security invoker set search_path = '' as $$
declare article public.blog_drafts;
begin
 select * into article from public.blog_drafts where id=article_id;
 if article.id is null then raise exception 'Article unavailable'; end if;
 if length(trim(article.title))=0 or length(trim(article.excerpt))=0 or length(trim(article.content))<100 then raise exception 'Title, summary and article required'; end if;
 if exists(select 1 from public.blog_publications where id=article_id and slug<>article.slug) then raise exception 'Published address cannot change'; end if;
 insert into public.blog_publications (id,slug,title,excerpt,content,author,updated_at)
 values(article.id,article.slug,article.title,article.excerpt,article.content,article.author,now())
 on conflict (id) do update set title=excluded.title,excerpt=excluded.excerpt,content=excluded.content,author=excluded.author,updated_at=excluded.updated_at;
end; $$;
revoke all on function public.publish_blog_article(uuid) from public,anon;
grant execute on function public.publish_blog_article(uuid) to authenticated;
