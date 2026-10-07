begin;

create table public.categories (
  name text primary key check (name = btrim(name) and length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
insert into public.categories(name) values ('Automation'), ('Awareness'), ('Strategy');
insert into public.categories(name) select distinct category from public.posts on conflict do nothing;
alter table public.categories enable row level security;
grant select on public.categories to anon, authenticated, service_role;
grant insert, update, delete on public.categories to authenticated;
create policy "Public reads categories" on public.categories for select to anon, authenticated using (true);
create policy "Admins manage categories" on public.categories for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
alter table public.posts drop constraint posts_category_check;
alter table public.posts add constraint posts_category_fkey foreign key (category)
references public.categories(name) on update cascade on delete restrict;
create index posts_category on public.posts(category);

create table public.site_settings (
  id boolean primary key default true check (id),
  name text not null check (length(btrim(name)) between 1 and 80),
  tagline text not null check (length(btrim(tagline)) between 1 and 160),
  description text not null check (length(btrim(description)) between 1 and 500),
  default_author text not null check (length(btrim(default_author)) between 1 and 200)
);
insert into public.site_settings values (true, 'AI Insights', 'Practical AI automation, explained clearly',
'Guides, breakdowns and honest opinions on AI automation, workflow tooling and staying aware of how AI changes work.', 'AI Insights');
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated, service_role;
grant update on public.site_settings to authenticated;
create policy "Public reads settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Admins update settings" on public.site_settings for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create function public.admin_access() returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_admin(); $$;
revoke all on function public.admin_access() from public, anon;
grant execute on function public.admin_access() to authenticated;

grant insert, update, delete on public.blog_images to authenticated;
create policy "Admins manage image records" on public.blog_images for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

-- Keep storage and its registry protected from deleting referenced images, even from another tab.
create function private.image_unused(image_url text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select not exists (select 1 from public.posts where cover_image_url = image_url or strpos(body, image_url) > 0);
$$;
revoke all on function private.image_unused(text) from public, anon;
grant execute on function private.image_unused(text) to authenticated;
create policy "Admins delete unused image records" on public.blog_images as restrictive for delete to authenticated
using (private.image_unused(url));
create policy "Admins list blog images" on storage.objects for select to authenticated
using (bucket_id = 'blog-images' and (select private.is_admin()));
create policy "Admins upload blog images" on storage.objects for insert to authenticated
with check (bucket_id = 'blog-images' and name ~ '^articles/[a-f0-9]{64}\.(png|jpg|webp)$' and (select private.is_admin()));
create policy "Admins delete unused blog images" on storage.objects for delete to authenticated
using (bucket_id = 'blog-images' and (select private.is_admin()) and
private.image_unused('https://gutvbukqlqutjwlbmfpr.supabase.co/storage/v1/object/public/blog-images/' || name));

-- Use the same URL validation as the public renderer (literal dots in the SQL regex).
alter table public.posts drop constraint posts_cover_image_url;
alter table public.posts add constraint posts_cover_image_url check (
cover_image_url = '' or cover_image_url ~ '^https://gutvbukqlqutjwlbmfpr\.supabase\.co/storage/v1/object/public/blog-images/articles/[a-f0-9]{64}\.(png|jpg|webp)$');
commit;
