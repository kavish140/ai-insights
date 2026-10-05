begin;

alter table public.posts add column revision bigint not null default 1;
grant select, insert, update on public.posts to service_role;

create or replace function private.touch_post()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;

create table public.post_activity (
  id bigint generated always as identity primary key,
  post_id uuid not null,
  action text not null,
  source text not null,
  actor_id uuid,
  request_id uuid,
  revision bigint not null,
  previous_status text,
  status text,
  created_at timestamptz not null default now()
);
alter table public.post_activity enable row level security;
revoke all on public.post_activity from anon, authenticated;
grant select on public.post_activity to authenticated;
grant all on public.post_activity to service_role;
grant usage, select on sequence public.post_activity_id_seq to service_role;
create policy "Admins read activity" on public.post_activity for select to authenticated
using ((select private.is_admin()));
create index post_activity_post_time on public.post_activity (post_id, created_at desc);

create function private.record_post_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tool text := nullif(current_setting('app.mcp_tool', true), '');
  request_id uuid := nullif(current_setting('app.mcp_request_id', true), '')::uuid;
begin
  insert into public.post_activity(post_id, action, source, actor_id, request_id, revision, previous_status, status)
  values (
    case when tg_op = 'DELETE' then old.id else new.id end,
    coalesce(tool, lower(tg_op)),
    case when tool is not null then 'mcp-public' else 'admin' end,
    auth.uid(), request_id,
    case when tg_op = 'DELETE' then old.revision else new.revision end,
    case when tg_op = 'INSERT' then null else old.status end,
    case when tg_op = 'DELETE' then null else new.status end
  );
  return null;
end;
$$;
revoke all on function private.record_post_activity() from public, anon, authenticated;
create trigger posts_activity after insert or update or delete on public.posts
for each row execute function private.record_post_activity();

create table private.mcp_requests (
  request_id uuid primary key,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table private.mcp_requests enable row level security;
revoke all on private.mcp_requests from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert on private.mcp_requests to service_role;

-- Only the Edge Function's server credential may call this transaction.
-- Public and signed-in website clients cannot call it directly.
create function public.mcp_write_post(
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
  if exists (select 1 from jsonb_object_keys(p_payload) k where k not in ('title', 'slug', 'description', 'category', 'author', 'date', 'body', 'featured', 'reading_minutes')) then
    raise exception 'Unsupported article field';
  end if;
  perform set_config('app.mcp_tool', p_tool, true);
  perform set_config('app.mcp_request_id', p_request_id::text, true);

  if p_tool = 'create_draft' then
    if p_post_id is not null or p_expected_revision is not null then raise exception 'New drafts cannot specify an existing post'; end if;
    insert into public.posts(title, slug, description, category, author, date, body, featured, reading_minutes, status)
    values (
      p_payload->>'title', p_payload->>'slug', p_payload->>'description', p_payload->>'category',
      coalesce(p_payload->>'author', 'AI Insights'), coalesce((p_payload->>'date')::date, current_date),
      p_payload->>'body', coalesce((p_payload->>'featured')::boolean, false),
      coalesce((p_payload->>'reading_minutes')::integer, 1), 'draft'
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
        reading_minutes = coalesce((p_payload->>'reading_minutes')::integer, reading_minutes)
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
revoke all on function public.mcp_write_post(text, uuid, jsonb, uuid, bigint) from public, anon, authenticated;
grant execute on function public.mcp_write_post(text, uuid, jsonb, uuid, bigint) to service_role;

commit;
