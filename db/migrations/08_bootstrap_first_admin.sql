-- ============================================================================
-- 08_bootstrap_first_admin.sql
-- One-time helper to promote the very first portal admin.
--
-- WHY:
--   Every new profiles row defaults to Member (is_coach = false,
--   is_portal_admin = false). Writes to team_members/coaches/mentors/alumni
--   and the "/admin" dashboard itself all require is_portal_manager() (coach
--   or admin) to be true, and the User Management tab that promotes other
--   users is only visible to admins. So a brand new project has nobody who
--   can grant that first role through the UI, which is what causes
--   "new row violates row-level security policy" on tables like alumni for
--   a freshly registered account.
--
-- HOW TO USE:
--   Replace the email address below with the account you want to bootstrap
--   as admin, then run this once in the Supabase SQL editor. After that,
--   use the portal's User Management tab to promote/demote everyone else.
--   Works even if this account registered before the 07 trigger existed and
--   has no profiles row yet, or before the profiles table had updated_at.
-- ============================================================================

alter table public.profiles add column if not exists updated_at timestamptz not null default now();

insert into public.profiles (user_id, display_name, is_coach, is_portal_admin)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1), 'Admin'), false, true
from auth.users
where email = 'REPLACE_WITH_YOUR_EMAIL@example.com'
on conflict (user_id) do update
  set is_portal_admin = true,
      updated_at = now();
