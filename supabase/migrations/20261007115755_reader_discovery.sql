begin;
create function private.valid_reader_tags(items text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(items) <= 12 and not exists (
    select 1 from unnest(items) t where t is null or length(t) not between 1 and 40 or t <> lower(btrim(t))
  ) and cardinality(items) = (select count(distinct t) from unnest(items) t);
$$;
grant execute on function private.valid_reader_tags(text[]) to anon, authenticated, service_role;
alter table public.posts add column tags text[] not null default '{}',
  add column audience_tags text[] not null default '{}',
  add constraint posts_tags_valid check (private.valid_reader_tags(tags)),
  add constraint posts_audience_tags_valid check (private.valid_reader_tags(audience_tags));
-- Initial editorial tags for existing articles; later edits remain authoritative.
update public.posts set tags=array['ai workflows','workflow testing','invent'], audience_tags=array['automation builders','operations teams'] where slug='invent-workflow-testing-checklist' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['email','ai workflows','triage'], audience_tags=array['operations teams','business owners'] where slug='ai-email-triage-shared-operations-inbox' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['ai literacy','workplace skills'], audience_tags=array['beginners','professionals'] where slug='ai-literacy-at-work-skills' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['gemini','ai workflows','migration'], audience_tags=array['automation builders','professionals'] where slug='gemini-skills-vs-gems-migration-guide' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['gemini','ai models','pricing'], audience_tags=array['professionals','business owners'] where slug='gemini-4-argon-availability-pricing' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['chatgpt','watermarking','ai literacy'], audience_tags=array['content creators','professionals'] where slug='chatgpt-text-watermarking-textgrain' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['ai agents','context','atlassian'], audience_tags=array['developers','team leaders'] where slug='ai-context-layer-openai-atlassian' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['ai agents','approvals','ai workflows'], audience_tags=array['automation builders','team leaders'] where slug='openai-dots-approval-rules-checklist' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['ai strategy','implementation'], audience_tags=array['team leaders','business owners'] where slug='ai-implementation-team-strategy' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['google workspace','ai workflows'], audience_tags=array['professionals','automation builders'] where slug='google-workspace-studio-automations' and cardinality(tags)=0 and cardinality(audience_tags)=0;
update public.posts set tags=array['ai agents','ecommerce','ai strategy'], audience_tags=array['business owners','marketers'] where slug='agentic-shopping-small-business' and cardinality(tags)=0 and cardinality(audience_tags)=0;
create index posts_tags on public.posts using gin(tags);
create index posts_audience_tags on public.posts using gin(audience_tags);

create table public.post_readership (
  post_id uuid primary key references public.posts(id) on delete cascade,
  views bigint not null default 0 check (views >= 0)
);
alter table public.post_readership enable row level security;
grant select on public.post_readership to anon, authenticated;
grant all on public.post_readership to service_role;
create policy "Published readership totals" on public.post_readership for select to anon, authenticated
using (exists (select 1 from public.posts p where p.id = post_id and p.status='published' and p.date <= current_date));
create view public.article_catalog with (security_invoker = true) as
select p.*, coalesce(r.views,0) as view_count from public.posts p left join public.post_readership r on r.post_id=p.id;
grant select on public.article_catalog to anon, authenticated, service_role;

create function public.related_articles(p_slug text) returns setof public.article_catalog
language sql stable security invoker set search_path = '' as $$
  select candidate.* from public.article_catalog candidate
  join public.article_catalog current on current.slug=p_slug
  where current.status='published' and current.date<=current_date
    and candidate.status='published' and candidate.date<=current_date and candidate.slug<>p_slug
    and (candidate.tags && current.tags or candidate.audience_tags && current.audience_tags or candidate.category=current.category)
  order by
    ((select count(*) from unnest(candidate.tags) t where t=any(current.tags))*3 +
     (select count(*) from unnest(candidate.audience_tags) t where t=any(current.audience_tags))*2 +
     case when candidate.category=current.category then 1 else 0 end) desc,
    candidate.view_count desc,candidate.date desc,candidate.slug
  limit 3;
$$;
revoke all on function public.related_articles(text) from public;
grant execute on function public.related_articles(text) to anon,authenticated,service_role;

-- Raw sessions stay private and expire after 90 days; totals contain no identifiers.
create table private.article_reads (
  post_id uuid not null references public.posts(id) on delete cascade,
  session_id uuid not null,
  day date not null default current_date,
  source text not null check (source in ('direct','internal','google','other-search','external')),
  device text not null check (device in ('mobile','desktop')),
  engaged boolean not null default false,
  primary key(post_id,session_id,day)
);
alter table private.article_reads enable row level security;
create index article_reads_day on private.article_reads(day);
create index article_reads_session_day on private.article_reads(session_id,day);

-- A narrow public ingestion API is necessary because visitors cannot write tables.
-- It accepts only published slugs, server dates, enums and one read/post/session/day.
create function public.record_article_read(p_slug text, p_session uuid, p_source text,
  p_device text, p_engaged boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare article_id uuid; inserted_count integer;
begin
  if auth.uid() is not null or p_session is null or length(p_slug)>200 or
    p_source not in ('direct','internal','google','other-search','external') or
    p_device not in ('mobile','desktop') or p_engaged is null then return; end if;
  select id into article_id from public.posts where slug=p_slug and status='published' and date<=current_date;
  if article_id is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session::text, 1));
  if (select count(*) from private.article_reads where session_id=p_session and day=current_date)>=200 then return; end if;
  insert into private.article_reads(post_id,session_id,source,device,engaged)
    values(article_id,p_session,p_source,p_device,p_engaged) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    insert into public.post_readership(post_id,views) values(article_id,1)
      on conflict(post_id) do update set views=public.post_readership.views+1;
  elsif p_engaged then
    update private.article_reads set engaged=true where post_id=article_id and session_id=p_session and day=current_date;
  end if;
  delete from private.article_reads where day < current_date - 90;
end;
$$;
revoke all on function public.record_article_read(text,uuid,text,text,boolean) from public;
grant execute on function public.record_article_read(text,uuid,text,text,boolean) to anon, authenticated;

create function public.reader_analytics(p_days integer default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare report jsonb;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_days is null or p_days not in (7,30,90) then raise exception 'Choose 7, 30 or 90 days'; end if;
  delete from private.article_reads where day < current_date - 90;
  with reads as (select * from private.article_reads where day >= current_date-(p_days-1)),
  top_posts as (select p.slug,p.title,count(*) views,count(*) filter(where r.engaged) engaged
    from reads r join public.posts p on p.id=r.post_id group by p.id order by views desc,p.slug limit 20),
  topics as (select t tag,count(*) views from reads r join public.posts p on p.id=r.post_id cross join lateral unnest(p.tags) t group by t order by views desc,t limit 20),
  audiences as (select t tag,count(*) views from reads r join public.posts p on p.id=r.post_id cross join lateral unnest(p.audience_tags) t group by t order by views desc,t limit 20),
  sources as (select source label,count(*) views from reads group by source order by views desc),
  devices as (select device label,count(*) views from reads group by device order by views desc),
  daily as (select day,count(*) views,count(distinct session_id) sessions from reads group by day order by day)
  select jsonb_build_object('views',(select count(*) from reads),
    'sessions',(select count(distinct session_id) from reads),
    'engaged',(select count(*) from reads where engaged),
    'posts',coalesce((select jsonb_agg(top_posts) from top_posts),'[]'::jsonb),
    'topics',coalesce((select jsonb_agg(topics) from topics),'[]'::jsonb),
    'audiences',coalesce((select jsonb_agg(audiences) from audiences),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(sources) from sources),'[]'::jsonb),
    'devices',coalesce((select jsonb_agg(devices) from devices),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(daily) from daily),'[]'::jsonb)) into report;
  return report;
end;
$$;
revoke all on function public.reader_analytics(integer) from public,anon;
grant execute on function public.reader_analytics(integer) to authenticated;

create or replace function public.mcp_write_post(
  p_tool text,
  p_request_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_post_id uuid default null,
  p_expected_revision bigint default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  supplied_input jsonb;
  previous_input jsonb;
  result jsonb;
  article public.posts%rowtype;
begin
  if p_request_id is null then raise exception 'request_id is required'; end if;
  supplied_input := jsonb_build_object('tool', p_tool, 'payload', p_payload, 'post_id', p_post_id, 'expected_revision', p_expected_revision);
  -- Serialize retries with the same id, including across function instances.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select r.input, r.result into previous_input, result from private.mcp_requests r where r.request_id = p_request_id;
  if found then
    if previous_input <> supplied_input then raise exception 'REQUEST_ID_REUSED: use a new request_id for different input'; end if;
    return result || jsonb_build_object('replayed', true);
  end if;

  if p_tool is null or p_tool not in ('create_draft', 'update_draft', 'publish_post', 'unpublish_post') then
    raise exception 'Unsupported operation';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Payload must be an object'; end if;
  if exists (select 1 from jsonb_object_keys(p_payload) k where k not in ('title', 'slug', 'description', 'category', 'author', 'date', 'body', 'featured', 'reading_minutes', 'cover_image_url', 'cover_image_alt', 'tags', 'audience_tags')) then
    raise exception 'Unsupported article field';
  end if;
  perform set_config('app.mcp_tool', p_tool, true);
  perform set_config('app.mcp_request_id', p_request_id::text, true);

  if p_tool = 'create_draft' then
    if p_post_id is not null or p_expected_revision is not null then raise exception 'New drafts cannot specify an existing post'; end if;
    insert into public.posts(title, slug, description, category, author, date, body, featured, reading_minutes, status, cover_image_url, cover_image_alt, tags, audience_tags)
    values (
      p_payload->>'title', p_payload->>'slug', p_payload->>'description', p_payload->>'category',
      coalesce(p_payload->>'author', (select default_author from public.site_settings where id), 'AI Insights'), coalesce((p_payload->>'date')::date, current_date),
      p_payload->>'body', coalesce((p_payload->>'featured')::boolean, false),
      coalesce((p_payload->>'reading_minutes')::integer, 1), 'draft',
      coalesce(p_payload->>'cover_image_url', ''), coalesce(p_payload->>'cover_image_alt', ''),
      array(select jsonb_array_elements_text(coalesce(p_payload->'tags', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(p_payload->'audience_tags', '[]'::jsonb)))
    ) returning * into article;
  else
    if p_post_id is null or p_expected_revision is null then raise exception 'post_id and expected_revision are required'; end if;
    select * into article from public.posts where id = p_post_id for update;
    if not found then raise exception 'POST_NOT_FOUND'; end if;
    if article.revision <> p_expected_revision then raise exception 'REVISION_CONFLICT: reload the post before changing it'; end if;

    if p_tool = 'update_draft' then
      if article.status <> 'draft' then raise exception 'Only drafts can be edited. Unpublish the article first.'; end if;
      update public.posts set
        title = coalesce(p_payload->>'title', title),
        slug = coalesce(p_payload->>'slug', slug),
        description = coalesce(p_payload->>'description', description),
        category = coalesce(p_payload->>'category', category),
        author = coalesce(p_payload->>'author', author),
        date = coalesce((p_payload->>'date')::date, date),
        body = coalesce(p_payload->>'body', body),
        featured = coalesce((p_payload->>'featured')::boolean, featured),
        reading_minutes = coalesce((p_payload->>'reading_minutes')::integer, reading_minutes),
        cover_image_url = coalesce(p_payload->>'cover_image_url', cover_image_url),
        cover_image_alt = coalesce(p_payload->>'cover_image_alt', cover_image_alt),
        tags = case when p_payload ? 'tags' then array(select jsonb_array_elements_text(p_payload->'tags')) else tags end,
        audience_tags = case when p_payload ? 'audience_tags' then array(select jsonb_array_elements_text(p_payload->'audience_tags')) else audience_tags end
      where id = p_post_id returning * into article;
    elsif p_tool = 'publish_post' then
      if article.status <> 'draft' then raise exception 'Post is already published'; end if;
      if article.date > current_date then raise exception 'Future publication dates are not supported in version one'; end if;
      update public.posts set status = 'published' where id = p_post_id returning * into article;
    else
      if article.status <> 'published' then raise exception 'Post is already a draft'; end if;
      update public.posts set status = 'draft' where id = p_post_id returning * into article;
    end if;
  end if;
  result := jsonb_build_object('post', to_jsonb(article), 'replayed', false);
  insert into private.mcp_requests(request_id, input, result) values (p_request_id, supplied_input, result);
  return result;
end;
$$;

commit;
