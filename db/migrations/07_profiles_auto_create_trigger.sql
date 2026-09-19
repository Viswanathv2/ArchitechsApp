-- ============================================================================
-- 07_profiles_auto_create_trigger.sql
-- Auto-create a profiles row whenever a new auth.users row is created.
--
-- WHY:
--   Supabase signUp() does not return an active session when email
--   confirmation is required, so a client-side insert into public.profiles
--   right after signUp() runs as the anonymous role and is rejected by the
--   "profiles self insert" RLS policy ("new row violates row-level security
--   policy for table profiles"). Creating the row from a security definer
--   trigger runs as the table owner and bypasses that RLS check entirely,
--   so registration works regardless of email confirmation settings.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, is_coach, is_portal_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Member'),
    false,
    false
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
