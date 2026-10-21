-- Users may have authenticated before the application schema was deployed.
insert into public.profiles (id, name, email)
select
  u.id,
  left(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)), 120),
  u.email
from auth.users u
where u.email is not null
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
