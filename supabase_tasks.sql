-- ============================================================================
-- Team Activities: tasks table + email columns on people tables
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- Adds:
--   1. email column on team_members, coaches, mentors  -> links a person to
--      their login email so they can manage their own tasks after signing in.
--   2. tasks  -> tasks assigned to any team member, coach, or mentor.
--      tasks.member_type distinguishes which table member_id points at.
-- ============================================================================

-- ---- 1. email columns -----------------------------------------------------
alter table public.team_members add column if not exists email text;
alter table public.coaches      add column if not exists email text;
alter table public.mentors      add column if not exists email text;

-- ---- 2. tasks table -------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null,
  member_type text not null default 'team_member',  -- team_member | coach | mentor
  task        text not null,
  start_date  date,
  end_date    date,
  status      text not null default 'Not Started',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- For installs created before member_type existed:
alter table public.tasks add column if not exists member_type text not null default 'team_member';

-- Drop the old strict FK (team_members only) so tasks can reference
-- coaches and mentors as well. Integrity is handled at the app layer.
alter table public.tasks drop constraint if exists tasks_member_id_fkey;

create index if not exists tasks_member_id_idx on public.tasks (member_id);
create index if not exists tasks_member_lookup_idx on public.tasks (member_type, member_id);


-- ---- RLS ------------------------------------------------------------------
-- Mirrors the rest of the portal: public read, authenticated write.
-- App-level logic decides who may edit which fields (coach vs. own tasks).
alter table public.tasks enable row level security;

drop policy if exists "tasks public read" on public.tasks;
create policy "tasks public read"
  on public.tasks for select
  using (true);

drop policy if exists "tasks authenticated insert" on public.tasks;
create policy "tasks authenticated insert"
  on public.tasks for insert
  to authenticated
  with check (true);

drop policy if exists "tasks authenticated update" on public.tasks;
create policy "tasks authenticated update"
  on public.tasks for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "tasks authenticated delete" on public.tasks;
create policy "tasks authenticated delete"
  on public.tasks for delete
  to authenticated
  using (true);
