-- Share only the Google photo URL through the existing authorized profile relation.
alter table public.profiles add column if not exists avatar_url text;

create or replace function public.sync_profile_photo() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.profiles set avatar_url=case
  when new.raw_user_meta_data->>'avatar_url' like 'https://%' then new.raw_user_meta_data->>'avatar_url'
  when new.raw_user_meta_data->>'picture' like 'https://%' then new.raw_user_meta_data->>'picture'
  else null end
 where id=new.id;
 return new;
end $$;
revoke all on function public.sync_profile_photo() from public,anon,authenticated;
drop trigger if exists sync_google_profile_photo on auth.users;
create trigger sync_google_profile_photo after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_profile_photo();

update public.profiles p set avatar_url=case
 when u.raw_user_meta_data->>'avatar_url' like 'https://%' then u.raw_user_meta_data->>'avatar_url'
 when u.raw_user_meta_data->>'picture' like 'https://%' then u.raw_user_meta_data->>'picture'
 else null end
from auth.users u where p.id=u.id;
