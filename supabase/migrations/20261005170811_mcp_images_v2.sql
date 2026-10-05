begin;

alter table public.posts
  add column cover_image_url text not null default '',
  add column cover_image_alt text not null default '',
  add constraint posts_cover_alt_length check (length(cover_image_alt) <= 300),
  add constraint posts_cover_image_url check (
    cover_image_url = '' or cover_image_url ~ '^https://gutvbukqlqutjwlbmfpr\.supabase\.co/storage/v1/object/public/blog-images/articles/[a-f0-9]{64}\.(png|jpg|webp)$'
  );

create table public.blog_images (
  path text primary key check (path ~ '^articles/[a-f0-9]{64}\.(png|jpg|webp)$'),
  url text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 4194304),
  alt text not null check (length(alt) between 1 and 300),
  source_url text not null check (length(source_url) between 1 and 2000),
  credit text not null check (length(credit) between 1 and 300),
  license_note text not null check (length(license_note) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.blog_images enable row level security;
revoke all on public.blog_images from public, anon, authenticated;
grant select on public.blog_images to authenticated;
create policy "Admins read image records" on public.blog_images for select to authenticated
using ((select private.is_admin()));
grant select, insert on public.blog_images to service_role;
create index blog_images_created_path on public.blog_images (created_at desc, path desc);

-- Create the public blog-images bucket separately in the Storage dashboard.
-- No anonymous or authenticated upload policy is needed: the Edge Function uploads with its server credential.

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
      coalesce(p_payload->>'author', 'AI Insights'), coalesce((p_payload->>'date')::date, current_date),
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
revoke all on function public.mcp_write_post(text, uuid, jsonb, uuid, bigint) from public, anon, authenticated;
grant execute on function public.mcp_write_post(text, uuid, jsonb, uuid, bigint) to service_role;

commit;
