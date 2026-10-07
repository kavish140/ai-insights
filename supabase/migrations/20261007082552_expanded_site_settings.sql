begin;
alter table public.site_settings
  add column settings_revision integer not null default 1,
  add column settings_updated_at timestamptz not null default now(),
  add column brand_initials text not null default 'AI' check (length(btrim(brand_initials)) between 1 and 3),
  add column header_cta_label text not null default 'Start reading' check (length(btrim(header_cta_label)) between 1 and 30),
  add column home_title text not null default 'AI automation, explained without the hype' check (length(btrim(home_title)) between 1 and 120),
  add column home_seo_title text not null default 'AI Insights — Practical AI Automation & Awareness' check (length(btrim(home_seo_title)) between 1 and 120),
  add column home_seo_description text not null default 'Clear guides on AI automation, agents and workflows, plus honest awareness pieces on privacy and misinformation.' check (length(btrim(home_seo_description)) between 1 and 160),
  add column home_latest_count integer not null default 6 check (home_latest_count between 2 and 24),
  add column articles_per_page integer not null default 12 check (articles_per_page between 6 and 48),
  add column show_reading_path boolean not null default true,
  add column show_house_ads boolean not null default true,
  add column newsletter_enabled boolean not null default true,
  add column contact_form_enabled boolean not null default true,
  add column newsletter_title text not null default 'Practical AI, in your inbox.' check (length(btrim(newsletter_title)) between 1 and 120),
  add column newsletter_description text not null default 'Get new guides and workflow checklists. Useful steps, clear tradeoffs, and no hype.' check (length(btrim(newsletter_description)) between 1 and 400),
  add column contact_email text not null default 'kavishganatra5@gmail.com' check (length(contact_email) <= 254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  add column footer_note text not null default 'All rights reserved.' check (length(btrim(footer_note)) between 1 and 200),
  add column linkedin_url text not null default '' check (length(linkedin_url) <= 500 and (linkedin_url = '' or linkedin_url ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$')),
  add column youtube_url text not null default '' check (length(youtube_url) <= 500 and (youtube_url = '' or youtube_url ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$')),
  add column x_url text not null default '' check (length(x_url) <= 500 and (x_url = '' or x_url ~ '^https://[^[:space:]@/?#]+([/?#][^[:space:]]*)?$')),
  add column default_category text references public.categories(name) on update cascade on delete set null;

create table public.site_settings_history (
  id bigint generated always as identity primary key,
  actor_id uuid,
  before_value jsonb not null,
  after_value jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.site_settings_history enable row level security;
revoke all on public.site_settings_history from public, anon, authenticated;
grant select on public.site_settings_history to authenticated;
create policy "Admins read settings history" on public.site_settings_history for select to authenticated using ((select private.is_admin()));
create function private.audit_site_settings() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.settings_revision := old.settings_revision + 1;
  new.settings_updated_at := now();
  insert into public.site_settings_history(actor_id,before_value,after_value) values(auth.uid(),to_jsonb(old),to_jsonb(new));
  return new;
end;
$$;
revoke all on function private.audit_site_settings() from public, anon, authenticated;
create trigger site_settings_audit before update on public.site_settings for each row execute function private.audit_site_settings();
commit;
