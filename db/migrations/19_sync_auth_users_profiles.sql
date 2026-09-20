-- Ensure every registered Supabase Auth user has a public profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, is_coach, is_portal_admin, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Member'),
    false,
    false,
    coalesce(new.created_at, now())
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (user_id, display_name, is_coach, is_portal_admin, created_at)
select
  user_record.id,
  coalesce(
    user_record.raw_user_meta_data ->> 'display_name',
    split_part(user_record.email, '@', 1),
    'Member'
  ),
  false,
  false,
  coalesce(user_record.created_at, now())
from auth.users user_record
on conflict (user_id) do nothing;