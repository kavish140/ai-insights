begin;

create table public.post_revisions (
  post_id uuid not null,
  revision bigint not null,
  snapshot jsonb not null,
  source text not null,
  actor_id uuid,
  created_at timestamptz not null default now(),
  primary key (post_id, revision)
);
alter table public.post_revisions enable row level security;
revoke all on public.post_revisions from public, anon, authenticated;
grant select on public.post_revisions to authenticated;
create policy "Admins read revisions" on public.post_revisions for select to authenticated
using ((select private.is_admin()));
insert into public.post_revisions(post_id,revision,snapshot,source,created_at)
select id, revision, to_jsonb(p), 'baseline', updated_at from public.posts p;

create function private.capture_post_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    insert into public.post_revisions(post_id,revision,snapshot,source,created_at)
    values(old.id,old.revision,to_jsonb(old),'baseline',old.updated_at) on conflict do nothing;
  end if;
  if tg_op <> 'DELETE' then
    insert into public.post_revisions(post_id,revision,snapshot,source,actor_id)
    values(new.id,new.revision,to_jsonb(new),coalesce(nullif(current_setting('app.mcp_tool',true),''),'admin'),auth.uid())
    on conflict do nothing;
  end if;
  return null;
end;
$$;
revoke all on function private.capture_post_revision() from public, anon, authenticated;
create trigger posts_revision_snapshot after insert or update or delete on public.posts
for each row execute function private.capture_post_revision();

create table public.mcp_operations (
  id uuid primary key default gen_random_uuid(),
  tool text not null check (length(tool) between 1 and 100),
  arguments jsonb not null default '{}',
  result jsonb not null default '{}',
  outcome text not null check (outcome in ('success','failed')),
  error text,
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);
alter table public.mcp_operations enable row level security;
revoke all on public.mcp_operations from public, anon, authenticated;
grant select on public.mcp_operations to authenticated;
grant select, insert on public.mcp_operations to service_role;
create policy "Admins read MCP operations" on public.mcp_operations for select to authenticated
using ((select private.is_admin()));
create index mcp_operations_time on public.mcp_operations(created_at desc,id);
create index mcp_operations_failures on public.mcp_operations(created_at desc) where outcome='failed';

alter table public.blog_images
add column width integer check (width between 1 and 100000),
add column height integer check (height between 1 and 100000);
commit;
