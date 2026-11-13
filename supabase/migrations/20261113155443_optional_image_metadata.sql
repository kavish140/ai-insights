-- Keep empty strings for optional metadata so existing clients can read string fields.
alter table public.blog_images
  drop constraint blog_images_source_url_check,
  drop constraint blog_images_credit_check,
  drop constraint blog_images_license_note_check,
  alter column source_url set default '',
  alter column credit set default '',
  alter column license_note set default '',
  add constraint blog_images_source_url_check check (length(source_url) <= 2000),
  add constraint blog_images_credit_check check (length(credit) <= 300),
  add constraint blog_images_license_note_check check (length(license_note) <= 500);
