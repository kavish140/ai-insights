-- Public visitors can only read published articles. Only designated admins can write.
create schema if not exists private;
revoke all on schema private from public;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  description text not null check (char_length(description) between 1 and 160),
  category text not null check (category in ('Automation', 'Awareness', 'Strategy')),
  date date not null default current_date,
  reading_minutes integer not null default 1 check (reading_minutes > 0),
  author text not null default 'AI Insights',
  featured boolean not null default false,
  body text not null check (char_length(body) between 1 and 200000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
create policy "Read published posts" on public.posts for select to anon, authenticated
  using (status = 'published' and date <= current_date);
create policy "Admins manage posts" on public.posts for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create index posts_public_date on public.posts (date desc) where status = 'published';

create function private.touch_post()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger posts_updated_at before update on public.posts
for each row execute function private.touch_post();

-- After creating your account in Supabase Authentication, grant editor access:
-- insert into public.admin_users(user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
