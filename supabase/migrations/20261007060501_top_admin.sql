begin;

create table public.mcp_controls (
  id boolean primary key default true check (id),
  revision integer not null default 1,
  paused boolean not null default false,
  disabled_tools text[] not null default '{}' check (disabled_tools <@ array['get_site_context','list_posts','get_post','create_draft','update_draft','validate_draft','publish_post','unpublish_post','upload_image','import_image_url','list_images']::text[]),
  calls_per_minute integer not null default 120 check (calls_per_minute between 1 and 1000),
  max_image_bytes integer not null default 4194304 check (max_image_bytes between 1024 and 4194304),
  allowed_formats text[] not null default array['png','jpg','webp'] check (cardinality(allowed_formats) > 0 and allowed_formats <@ array['png','jpg','webp']::text[]),
  require_cover boolean not null default false,
  require_description boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.mcp_controls(id) values(true);
alter table public.mcp_controls enable row level security;
revoke all on public.mcp_controls from public, anon, authenticated;
grant select, update on public.mcp_controls to authenticated;
grant select on public.mcp_controls to service_role;
create policy "Admins read MCP controls" on public.mcp_controls for select to authenticated using ((select private.is_admin()));
create policy "Admins update MCP controls" on public.mcp_controls for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create table public.control_activity (
  id bigint generated always as identity primary key,
  actor_id uuid,
  before_value jsonb not null,
  after_value jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.control_activity enable row level security;
revoke all on public.control_activity from public, anon, authenticated;
grant select on public.control_activity to authenticated;
create policy "Admins read control audit" on public.control_activity for select to authenticated using ((select private.is_admin()));
create function private.audit_mcp_controls() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  insert into public.control_activity(actor_id,before_value,after_value) values(auth.uid(),to_jsonb(old),to_jsonb(new));
  return new;
end;
$$;
revoke all on function private.audit_mcp_controls() from public, anon, authenticated;
create trigger mcp_controls_audit before update on public.mcp_controls for each row execute function private.audit_mcp_controls();

-- Shared across Edge Function instances. This is a global tool-call quota, not an identity limit.
create table private.mcp_quota (id boolean primary key check (id), window_start timestamptz not null, calls integer not null);
insert into private.mcp_quota values(true,now(),0);
alter table private.mcp_quota enable row level security;
revoke all on private.mcp_quota from public, anon, authenticated;
grant select, update on private.mcp_quota to service_role;
create function public.mcp_admit(p_tool text) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare controls public.mcp_controls%rowtype; quota private.mcp_quota%rowtype;
begin
  select * into controls from public.mcp_controls where id;
  if not found then raise exception 'MCP controls are unavailable'; end if;
  if controls.paused then return jsonb_build_object('error','MCP is paused by an administrator.'); end if;
  if p_tool = any(controls.disabled_tools) then return jsonb_build_object('error','This MCP tool is disabled by an administrator.'); end if;
  select * into quota from private.mcp_quota where id for update;
  if not found then raise exception 'MCP quota is unavailable'; end if;
  if quota.window_start <= clock_timestamp() - interval '1 minute' then
    quota.window_start := clock_timestamp(); quota.calls := 0;
  end if;
  if quota.calls >= controls.calls_per_minute then return jsonb_build_object('error','Global MCP call limit reached. Retry after one minute.'); end if;
  update private.mcp_quota set window_start=quota.window_start, calls=quota.calls+1 where id;
  return jsonb_build_object('controls',to_jsonb(controls));
end;
$$;
revoke all on function public.mcp_admit(text) from public, anon, authenticated;
grant execute on function public.mcp_admit(text) to service_role;

create table public.admin_checks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('health','content')),
  result jsonb not null check (octet_length(result::text) <= 1000000),
  actor_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.admin_checks enable row level security;
revoke all on public.admin_checks from public, anon, authenticated;
grant select, insert on public.admin_checks to authenticated;
create policy "Admins read checks" on public.admin_checks for select to authenticated using ((select private.is_admin()));
create policy "Admins record checks" on public.admin_checks for insert to authenticated with check ((select private.is_admin()) and actor_id=(select auth.uid()));
create index admin_checks_time on public.admin_checks(kind,created_at desc);
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
  if exists (select 1 from jsonb_object_keys(p_payload) k where k not in ('title', 'slug', 'description', 'category', 'author', 'date', 'body', 'featured', 'reading_minutes', 'cover_image_url', 'cover_image_alt')) then
    raise exception 'Unsupported article field';
  end if;
  perform set_config('app.mcp_tool', p_tool, true);
  perform set_config('app.mcp_request_id', p_request_id::text, true);

  if p_tool = 'create_draft' then
    if p_post_id is not null or p_expected_revision is not null then raise exception 'New drafts cannot specify an existing post'; end if;
    insert into public.posts(title, slug, description, category, author, date, body, featured, reading_minutes, status, cover_image_url, cover_image_alt)
    values (
      p_payload->>'title', p_payload->>'slug', p_payload->>'description', p_payload->>'category',
      coalesce(p_payload->>'author', (select default_author from public.site_settings where id), 'AI Insights'), coalesce((p_payload->>'date')::date, current_date),
      p_payload->>'body', coalesce((p_payload->>'featured')::boolean, false),
      coalesce((p_payload->>'reading_minutes')::integer, 1), 'draft',
      coalesce(p_payload->>'cover_image_url', ''), coalesce(p_payload->>'cover_image_alt', '')
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
        cover_image_alt = coalesce(p_payload->>'cover_image_alt', cover_image_alt)
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
