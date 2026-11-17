-- Switch the homepage pick in one transaction, retaining existing RLS and audit triggers.
create function public.admin_set_featured_post(p_post_id uuid default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  -- Serialize switches with other post writes while validating and updating the flags.
  lock table public.posts in share row exclusive mode;

  if p_post_id is not null and not exists (
    select 1 from public.posts
    where id = p_post_id and status = 'published'
      and date <= (now() at time zone 'UTC')::date
  ) then
    raise exception 'Choose a published article that is already live.' using errcode = '22023';
  end if;

  update public.posts
  set featured = coalesce(id = p_post_id, false)
  where featured is distinct from coalesce(id = p_post_id, false);
end;
$$;

revoke all on function public.admin_set_featured_post(uuid) from public, anon, authenticated;
grant execute on function public.admin_set_featured_post(uuid) to authenticated;

comment on function public.admin_set_featured_post(uuid) is
  'Admin-only atomic homepage feature selection. Null restores the newest-published fallback.';
