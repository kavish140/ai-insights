-- Create kavishganatra5@gmail.com in Authentication > Users > Add user first.
-- Choose your password there; enable Auto Confirm User for this manually created account.
-- Then run this in the SQL Editor after the articles migration.
do $$
declare admin_id uuid;
begin
  select id into admin_id from auth.users where email = 'kavishganatra5@gmail.com';
  if admin_id is null then
    raise exception 'Create kavishganatra5@gmail.com in Supabase Authentication first.';
  end if;
  insert into public.admin_users(user_id) values (admin_id) on conflict do nothing;
end;
$$;
