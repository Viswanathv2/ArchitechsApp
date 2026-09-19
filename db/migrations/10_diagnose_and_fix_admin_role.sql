-- ============================================================================
-- 10_diagnose_and_fix_admin_role.sql
-- Diagnose + fix "new row violates row-level security policy for table
-- alumni" when it persists after running 08_bootstrap_first_admin.sql.
--
-- WHY THIS STILL HAPPENS:
--   The #1 cause is that 08_bootstrap_first_admin.sql was run without
--   replacing 'REPLACE_WITH_YOUR_EMAIL@example.com' with a real email. Its
--   WHERE clause then matches zero rows in auth.users, so the script "runs
--   successfully" but silently promotes nobody.
--
-- STEP 1 — Run this SELECT first and check the output:
--   * 0 rows              -> the email below doesn't match any auth.users
--                            row. Fix the email (check for typos/whitespace)
--                            and re-run.
--   * 1 row, is_portal_admin = false and is_coach = false
--                            -> profile exists but was never promoted; run
--                            STEP 2 below.
--   * 1 row, is_portal_admin = true or is_coach = true
--                            -> the DB side is already correct. Make sure
--                            you are actually logged into the app with THIS
--                            exact email (sign out/in), since a different
--                            still-Member account will hit the same error.
-- ============================================================================

select u.email, p.user_id, p.display_name, p.is_coach, p.is_portal_admin
from auth.users u
left join public.profiles p on p.user_id = u.id
where lower(trim(u.email)) = lower(trim('REPLACE_WITH_YOUR_EMAIL@example.com'));

-- ---------------------------------------------------------------------------
-- STEP 2 — Promote that account (case-insensitive, whitespace-tolerant).
-- Safe to re-run.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

insert into public.profiles (user_id, display_name, is_coach, is_portal_admin)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1), 'Admin'), false, true
from auth.users
where lower(trim(email)) = lower(trim('REPLACE_WITH_YOUR_EMAIL@example.com'))
on conflict (user_id) do update
  set is_portal_admin = true,
      updated_at = now();
