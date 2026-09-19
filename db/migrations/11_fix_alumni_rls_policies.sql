-- ============================================================================
-- 11_fix_alumni_rls_policies.sql
-- Force-repair the alumni RLS policy + is_portal_manager() helper.
--
-- WHY:
--   Every earlier fix in this project (missing profiles.updated_at, alumni
--   year stored as integer) turned out to be schema drift: this database's
--   objects don't fully match db/migrations/01 and 03. If you've confirmed
--   your account's profiles row has is_portal_admin = true (via
--   10_diagnose_and_fix_admin_role.sql) and inserting into alumni still
--   fails with "new row violates row-level security policy", the most
--   likely remaining explanation is that is_portal_manager() and/or the
--   alumni write policy were never created here, or were created with
--   different logic. This script re-creates both from scratch so the
--   policy is guaranteed correct, regardless of what existed before.
--
-- STEP 1 — Run this diagnostic block first and share the output if the
-- problem persists after Step 2:
-- ============================================================================

select proname, prosecdef
from pg_proc
where proname = 'is_portal_manager';

select policyname, cmd, permissive, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'alumni';

-- ---------------------------------------------------------------------------
-- STEP 2 — Re-create the helper function and alumni policies. Safe to re-run.
-- ---------------------------------------------------------------------------
create or replace function public.is_portal_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (p.is_portal_admin = true or p.is_coach = true)
  );
$$;

grant execute on function public.is_portal_manager() to authenticated;

alter table public.alumni enable row level security;

drop policy if exists "alumni_public_read" on public.alumni;
create policy "alumni_public_read"
  on public.alumni
  for select
  using (is_active = true);

drop policy if exists "alumni_authenticated_read" on public.alumni;
create policy "alumni_authenticated_read"
  on public.alumni
  for select
  to authenticated
  using (true);

drop policy if exists "alumni_auth_write" on public.alumni;
create policy "alumni_auth_write"
  on public.alumni
  for all
  to authenticated
  using (public.is_portal_manager())
  with check (public.is_portal_manager());
