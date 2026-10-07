begin;

create table public.reader_tags (
  kind text not null check (kind in ('topic','audience')),
  name text not null check (name=lower(btrim(name)) and length(name) between 1 and 40),
  primary key(kind,name)
);
create table public.reader_tag_aliases (
  kind text not null,
  alias text not null check (alias=lower(btrim(alias)) and length(alias) between 1 and 40),
  name text not null,
  primary key(kind,alias),
  foreign key(kind,name) references public.reader_tags(kind,name) on delete restrict,
  check (alias<>name)
);
alter table public.reader_tags enable row level security;
alter table public.reader_tag_aliases enable row level security;
grant select on public.reader_tags,public.reader_tag_aliases to anon,authenticated,service_role;
create policy "Published reader vocabulary" on public.reader_tags for select to anon
using(exists(select 1 from public.posts p where p.status='published' and p.date<=current_date
  and ((kind='topic' and name=any(p.tags)) or (kind='audience' and name=any(p.audience_tags)))));
create policy "Admin or published vocabulary" on public.reader_tags for select to authenticated
using((select private.is_admin()) or exists(select 1 from public.posts p where p.status='published' and p.date<=current_date
  and ((kind='topic' and name=any(p.tags)) or (kind='audience' and name=any(p.audience_tags)))));
create policy "Visible tag aliases" on public.reader_tag_aliases for select to anon,authenticated
using(exists(select 1 from public.reader_tags t where t.kind=reader_tag_aliases.kind and t.name=reader_tag_aliases.name));
grant all on public.reader_tags,public.reader_tag_aliases to service_role;
insert into public.reader_tags(kind,name) select distinct 'topic',t from public.posts cross join lateral unnest(tags) t;
insert into public.reader_tags(kind,name) select distinct 'audience',t from public.posts cross join lateral unnest(audience_tags) t;

create function public.resolve_reader_tags(p_kind text,p_names text[]) returns text[]
language sql stable security invoker set search_path='' as $$
  select coalesce(array_agg(distinct coalesce(a.name,lower(btrim(t))) order by coalesce(a.name,lower(btrim(t)))),'{}'::text[])
  from unnest(p_names) t left join public.reader_tag_aliases a on a.kind=p_kind and a.alias=lower(btrim(t));
$$;
revoke all on function public.resolve_reader_tags(text,text[]) from public;
grant execute on function public.resolve_reader_tags(text,text[]) to anon,authenticated,service_role;

-- Runs only during an already-authorized post write, including MCP and revision restoration.
create function private.register_reader_tags() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Serialize vocabulary writes with merges, preventing old names from being recreated mid-merge.
  perform pg_advisory_xact_lock(hashtextextended('reader-tag-vocabulary',0));
  new.tags:=public.resolve_reader_tags('topic',new.tags);
  new.audience_tags:=public.resolve_reader_tags('audience',new.audience_tags);
  insert into public.reader_tags(kind,name) select 'topic',t from unnest(new.tags) t on conflict do nothing;
  insert into public.reader_tags(kind,name) select 'audience',t from unnest(new.audience_tags) t on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.register_reader_tags() from public,anon,authenticated;
create function private.lock_reader_tags() returns trigger
language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('reader-tag-vocabulary',0));
  return null;
end;
$$;
revoke all on function private.lock_reader_tags() from public,anon,authenticated;
create trigger posts_reader_tags_lock before insert or update of tags,audience_tags on public.posts
for each statement execute function private.lock_reader_tags();
create trigger posts_reader_tags before insert or update of tags,audience_tags on public.posts
for each row execute function private.register_reader_tags();

create table public.reader_tag_history (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  kind text not null,
  action text not null,
  source text,
  target text,
  affected_posts integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reader_tag_history enable row level security;
grant select on public.reader_tag_history to authenticated;
create policy "Admins read tag history" on public.reader_tag_history for select to authenticated
using((select private.is_admin()));

create function public.manage_reader_tag(p_kind text,p_action text,p_source text,p_target text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare source_name text:=lower(btrim(p_source)); target_name text:=lower(btrim(p_target)); affected integer:=0;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('topic','audience') or p_action is null or p_action not in ('create','merge','delete')
    or source_name is null or length(source_name) not between 1 and 40 or (p_action='create' and strpos(source_name,',')>0) then raise exception 'Invalid tag operation'; end if;
  perform pg_advisory_xact_lock(hashtextextended('reader-tag-vocabulary',0));
  if p_action='create' then
    if exists(select 1 from public.reader_tag_aliases where kind=p_kind and alias=source_name) then raise exception 'This name is an alias; use its current tag'; end if;
    insert into public.reader_tags(kind,name) values(p_kind,source_name);
  elsif p_action='delete' then
    if exists(select 1 from public.posts where (p_kind='topic' and source_name=any(tags)) or (p_kind='audience' and source_name=any(audience_tags))) then raise exception 'Tag is still used; merge it or remove it from articles first'; end if;
    if exists(select 1 from public.reader_tag_aliases where kind=p_kind and name=source_name) then raise exception 'Tag has aliases; merge it into another tag to preserve existing links'; end if;
    delete from public.reader_tags where kind=p_kind and name=source_name;
    if not found then raise exception 'Tag no longer exists; refresh'; end if;
  else
    if target_name is null or length(target_name) not between 1 and 40 or strpos(target_name,',')>0 then raise exception 'Invalid target tag'; end if;
    target_name:=(public.resolve_reader_tags(p_kind,array[target_name]))[1];
    if source_name=target_name then raise exception 'Choose a different target tag'; end if;
    if not exists(select 1 from public.reader_tags where kind=p_kind and name=source_name) then raise exception 'Tag no longer exists; refresh'; end if;
    insert into public.reader_tags(kind,name) values(p_kind,target_name) on conflict do nothing;
    update public.reader_tag_aliases set name=target_name where kind=p_kind and name=source_name;
    insert into public.reader_tag_aliases(kind,alias,name) values(p_kind,source_name,target_name);
    if p_kind='topic' then
      update public.posts set tags=public.resolve_reader_tags(p_kind,tags) where source_name=any(tags);
    else
      update public.posts set audience_tags=public.resolve_reader_tags(p_kind,audience_tags) where source_name=any(audience_tags);
    end if;
    get diagnostics affected=row_count;
    delete from public.reader_tags where kind=p_kind and name=source_name;
  end if;
  insert into public.reader_tag_history(actor_id,kind,action,source,target,affected_posts)
    values(auth.uid(),p_kind,p_action,source_name,target_name,affected);
  return affected;
end;
$$;
revoke all on function public.manage_reader_tag(text,text,text,text) from public,anon;
grant execute on function public.manage_reader_tag(text,text,text,text) to authenticated;

create function public.personalized_articles(p_topics text[],p_audiences text[]) returns setof public.article_catalog
language sql stable security invoker set search_path='' as $$
  with interests as (
    select public.resolve_reader_tags('topic',p_topics) topics,public.resolve_reader_tags('audience',p_audiences) audiences
    where cardinality(p_topics)<=12 and cardinality(p_audiences)<=12
  )
  select p.* from public.article_catalog p cross join interests i
  where p.status='published' and p.date<=current_date and (p.tags && i.topics or p.audience_tags && i.audiences)
  order by ((select count(*) from unnest(p.tags) t where t=any(i.topics))*3+
    (select count(*) from unnest(p.audience_tags) t where t=any(i.audiences))*2) desc,
    p.view_count desc,p.date desc,p.slug limit 6;
$$;
revoke all on function public.personalized_articles(text[],text[]) from public;
grant execute on function public.personalized_articles(text[],text[]) to anon,authenticated,service_role;

alter table private.article_reads add column quality_measured boolean not null default false,
  add column max_scroll integer not null default 0 check(max_scroll between 0 and 100),
  add column completed boolean not null default false,
  add column helpful boolean;
create function public.record_article_quality(p_slug text,p_session uuid,p_event text,
  p_scroll integer default 0,p_completed boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare article_id uuid;
begin
  if auth.uid() is not null or p_session is null or p_event is null or p_event not in ('progress','helpful','unhelpful')
    or p_scroll is null or p_scroll not between 0 and 100 or p_completed is null then return; end if;
  select id into article_id from public.posts where slug=p_slug and status='published' and date<=current_date;
  if article_id is null then return; end if;
  -- Quality updates never manufacture extra views. The tracker records a read first.
  update private.article_reads set quality_measured=true,max_scroll=greatest(max_scroll,p_scroll),
    completed=completed or (p_event='progress' and p_completed and p_scroll>=90),
    helpful=case when p_event='helpful' then true when p_event='unhelpful' then false else helpful end
  where post_id=article_id and session_id=p_session and day=current_date;
end;
$$;
revoke all on function public.record_article_quality(text,uuid,text,integer,boolean) from public;
grant execute on function public.record_article_quality(text,uuid,text,integer,boolean) to anon,authenticated;

create table private.recommendation_reads (
  target_id uuid not null references public.posts(id) on delete cascade,
  source_slug text not null,
  placement text not null check(placement in ('personalized','related')),
  session_id uuid not null,
  day date not null default current_date,
  clicked boolean not null default false,
  primary key(target_id,source_slug,placement,session_id,day)
);
alter table private.recommendation_reads enable row level security;
create index recommendation_reads_day on private.recommendation_reads(day);
create index recommendation_reads_session_day on private.recommendation_reads(session_id,day);
create function public.record_recommendation(p_target text,p_source text,p_placement text,p_session uuid,p_clicked boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare selected_target_id uuid;
begin
  if auth.uid() is not null or p_session is null or p_clicked is null or p_placement is null
    or p_placement not in ('personalized','related') or p_source is null or (p_placement='related' and p_target=p_source) then return; end if;
  if p_placement='personalized' and p_source<>'home' then return; end if;
  if p_placement='related' and not exists(select 1 from public.posts where slug=p_source and status='published' and date<=current_date) then return; end if;
  select id into selected_target_id from public.posts where slug=p_target and status='published' and date<=current_date;
  if selected_target_id is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session::text,2));
  if (select count(*) from private.recommendation_reads where session_id=p_session and day=current_date)>=200
    and not exists(select 1 from private.recommendation_reads r where r.target_id=selected_target_id and r.source_slug=p_source and r.placement=p_placement and r.session_id=p_session and r.day=current_date) then return; end if;
  insert into private.recommendation_reads(target_id,source_slug,placement,session_id,clicked)
    values(selected_target_id,p_source,p_placement,p_session,p_clicked)
    on conflict(target_id,source_slug,placement,session_id,day) do update set clicked=private.recommendation_reads.clicked or excluded.clicked;
  delete from private.recommendation_reads where day<current_date-90;
end;
$$;
revoke all on function public.record_recommendation(text,text,text,uuid,boolean) from public;
grant execute on function public.record_recommendation(text,text,text,uuid,boolean) to anon,authenticated;

-- Keep the old report intact so older deployed clients remain compatible.
create function public.reading_quality_analytics(p_days integer default 30) returns jsonb
language plpgsql security definer set search_path='' as $$
declare report jsonb;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_days is null or p_days not in (7,30,90) then raise exception 'Choose 7, 30 or 90 days'; end if;
  delete from private.recommendation_reads where day<current_date-90;
  delete from private.article_reads where day<current_date-90;
  with reads as (select * from private.article_reads where day>=current_date-(p_days-1) and quality_measured),
  recommendations as (select * from private.recommendation_reads where day>=current_date-(p_days-1)),
  post_quality as (select p.slug,p.title,count(*) measured,count(*) filter(where r.completed) completed,
    count(*) filter(where r.helpful=true) helpful,count(*) filter(where r.helpful=false) unhelpful,
    round(avg(r.max_scroll)) avg_scroll from reads r join public.posts p on p.id=r.post_id group by p.id order by measured desc,p.slug limit 20),
  placements as (select placement,count(*) impressions,count(*) filter(where clicked) clicks from recommendations group by placement)
  select jsonb_build_object('measured',(select count(*) from reads),
    'completed',(select count(*) from reads where completed),
    'helpful',(select count(*) from reads where helpful=true),
    'unhelpful',(select count(*) from reads where helpful=false),
    'impressions',(select count(*) from recommendations),'clicks',(select count(*) from recommendations where clicked),
    'posts',coalesce((select jsonb_agg(post_quality) from post_quality),'[]'::jsonb),
    'placements',coalesce((select jsonb_agg(placements) from placements),'[]'::jsonb)) into report;
  return report;
end;
$$;
revoke all on function public.reading_quality_analytics(integer) from public,anon;
grant execute on function public.reading_quality_analytics(integer) to authenticated;
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
  perform pg_advisory_xact_lock(hashtextextended('reader-tag-vocabulary',0));
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
