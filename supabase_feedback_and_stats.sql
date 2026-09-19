-- ============================================================================
-- Feedback approval + Season achievement stats (Architechs Team Portal)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Adds:
--   1. feedback.is_approved   -> public "Recent Comments" only shows approved
--   2. achievements stats     -> matches played / won, highest score, rank
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---- 1. FEEDBACK APPROVAL --------------------------------------------------
alter table public.feedback
  add column if not exists is_approved boolean not null default false;

-- Let the public read only approved comments; signed-in members (admins) read all.
drop policy if exists "feedback_public_read_approved" on public.feedback;
create policy "feedback_public_read_approved"
  on public.feedback
  for select
  using (is_approved = true);

drop policy if exists "feedback_auth_read_all" on public.feedback;
create policy "feedback_auth_read_all"
  on public.feedback
  for select
  to authenticated
  using (true);

-- Anyone can submit feedback (it stays hidden until approved).
drop policy if exists "feedback_public_insert" on public.feedback;
create policy "feedback_public_insert"
  on public.feedback
  for insert
  with check (true);

-- Signed-in members (admins/coaches) can approve / edit / delete feedback.
drop policy if exists "feedback_auth_update" on public.feedback;
create policy "feedback_auth_update"
  on public.feedback
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "feedback_auth_delete" on public.feedback;
create policy "feedback_auth_delete"
  on public.feedback
  for delete
  to authenticated
  using (true);

-- ---- 2. SEASON ACHIEVEMENT STATS (all optional) ----------------------------
alter table public.achievements
  add column if not exists matches_played integer,
  add column if not exists matches_won    integer,
  add column if not exists highest_score  text,
  add column if not exists overall_rank   text;

-- ============================================================================
