begin;

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    email = lower(btrim(email)) and length(email) between 3 and 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  consent boolean not null check (consent),
  consent_at timestamptz not null default now(),
  unsubscribed boolean not null default false,
  source text not null default 'website'
);
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant insert (email, consent) on public.newsletter_subscribers to anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;
grant update (unsubscribed) on public.newsletter_subscribers to authenticated;
grant all on public.newsletter_subscribers to service_role;

create policy "Visitors submit consented newsletter signups"
on public.newsletter_subscribers for insert to anon, authenticated
with check (consent and exists (
  select 1 from public.site_settings where id = true and newsletter_enabled
));
create policy "Admins read newsletter subscribers"
on public.newsletter_subscribers for select to authenticated
using ((select private.is_admin()));
create policy "Admins update newsletter subscription status"
on public.newsletter_subscribers for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

-- Blind, idempotent submission: callers cannot read existing emails or change their status.
create function public.subscribe_newsletter(p_email text, p_consent boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_consent is distinct from true then
    raise exception 'Newsletter consent is required' using errcode = '22023';
  end if;
  insert into public.newsletter_subscribers(email, consent)
  values (lower(btrim(p_email)), true) on conflict do nothing;
end;
$$;
revoke all on function public.subscribe_newsletter(text, boolean) from public;
grant execute on function public.subscribe_newsletter(text, boolean) to anon, authenticated;

commit;
