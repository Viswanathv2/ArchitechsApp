-- ============================================================================
-- Profile self-edit policy  +  FTC Team Interest Form table
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- WHY:
--   * The original team_members RLS only let a *portal admin* write. So when a
--     regular team member edited their own bio/role/grade/photo, the UPDATE was
--     silently blocked by RLS (0 rows changed, no error) -> nothing saved.
--   * These policies let a member update THEIR OWN row (matched by email), and
--     let coaches / portal admins update ANY member row.
--   * Also creates the interest_submissions table for the new Join / Onboard
--     interest form.
-- ============================================================================

-- ---- 1. Let members edit their own team_members row ------------------------
drop policy if exists "Members can update own row" on public.team_members;
create policy "Members can update own row"
  on public.team_members for update
  to authenticated
  using (lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ---- 2. Let coaches / portal admins edit ANY team_members row --------------
drop policy if exists "Managers can update any member" on public.team_members;
create policy "Managers can update any member"
  on public.team_members for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_portal_admin = true or p.is_coach = true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_portal_admin = true or p.is_coach = true)
    )
  );

-- ---- 3. FTC Team Interest Form submissions --------------------------------
create table if not exists public.interest_submissions (
  id                     uuid primary key default gen_random_uuid(),
  kind                   text not null,            -- 'join' | 'onboard'
  -- Join an FTC team
  full_name              text,
  grade                  text,
  email                  text,
  phone                  text,
  intro                  text,
  heard_about            text,
  acknowledged           boolean default false,
  -- Start / onboard a new FTC team
  team_location          text,
  student_count          text,
  needs_member_support   text,
  needs_onboarding_help  text,
  additional_info        text,
  created_at             timestamptz default now()
);

alter table public.interest_submissions enable row level security;

-- Anyone (including anonymous visitors) may submit the public form.
drop policy if exists "interest public insert" on public.interest_submissions;
create policy "interest public insert"
  on public.interest_submissions for insert
  with check (true);

-- Only signed-in users (coaches/admins reviewing) may read submissions.
drop policy if exists "interest authenticated read" on public.interest_submissions;
create policy "interest authenticated read"
  on public.interest_submissions for select
  to authenticated
  using (true);

-- ---- 4. Coach/admin review fields on submissions --------------------------
-- status: where this request stands; coach_note: free-text follow-up notes.
alter table public.interest_submissions add column if not exists status text default 'New';
alter table public.interest_submissions add column if not exists coach_note text;

-- Signed-in coaches/admins may update status + notes on a submission.
drop policy if exists "interest authenticated update" on public.interest_submissions;
create policy "interest authenticated update"
  on public.interest_submissions for update
  to authenticated
  using (true)
  with check (true);

-- ---- 5. Per-user notification dismissals ----------------------------------
-- A coach/admin can "clear" a submission notification just for themselves.
create table if not exists public.notification_dismissals (
  user_id       uuid not null,
  submission_id uuid not null references public.interest_submissions(id) on delete cascade,
  dismissed_at  timestamptz default now(),
  primary key (user_id, submission_id)
);

alter table public.notification_dismissals enable row level security;

drop policy if exists "dismissals own read" on public.notification_dismissals;
create policy "dismissals own read"
  on public.notification_dismissals for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "dismissals own insert" on public.notification_dismissals;
create policy "dismissals own insert"
  on public.notification_dismissals for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "dismissals own delete" on public.notification_dismissals;
create policy "dismissals own delete"
  on public.notification_dismissals for delete
  to authenticated
  using (user_id = auth.uid());

