-- ============================================================================
-- 15_archive_audit_and_outreaches.sql
-- 1. Adds soft-delete + "who deleted it" audit columns to tasks and issues
--    (issues already had is_archived/archived_at; this adds archived_by to
--    both, and adds archive support to tasks for the first time).
-- 2. Creates the outreaches table (Tech/STEM outreach hours log), following
--    the same member/soft-delete pattern as tasks and issues.
-- ============================================================================

alter table public.tasks add column if not exists is_archived boolean not null default false;
alter table public.tasks add column if not exists archived_at timestamptz;
alter table public.tasks add column if not exists archived_by text;

alter table public.issues add column if not exists archived_by text;

create index if not exists tasks_is_archived_idx on public.tasks (is_archived);

-- ---------------------------------------------------------------------------
-- Outreaches
-- ---------------------------------------------------------------------------
create table if not exists public.outreaches (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null,
  member_type    text not null default 'team_member',
  outreach_name  text not null,
  outreach_type  text not null default 'Tech',
  outreach_date  date,
  hours          numeric,
  notes          text,
  images         jsonb not null default '[]'::jsonb,
  is_archived    boolean not null default false,
  archived_at    timestamptz,
  archived_by    text,
  created_at     timestamptz not null default now()
);

create index if not exists outreaches_member_lookup_idx on public.outreaches (member_type, member_id);
create index if not exists outreaches_created_at_idx on public.outreaches (created_at desc);
create index if not exists outreaches_is_archived_idx on public.outreaches (is_archived);

alter table public.outreaches enable row level security;

-- Mirrors tasks/issues: fully open to authenticated users, with the
-- creator-or-admin delete rule enforced by the client.
drop policy if exists "outreaches public read" on public.outreaches;
create policy "outreaches public read"
  on public.outreaches
  for select
  using (true);

drop policy if exists "outreaches authenticated insert" on public.outreaches;
create policy "outreaches authenticated insert"
  on public.outreaches
  for insert
  to authenticated
  with check (true);

drop policy if exists "outreaches authenticated update" on public.outreaches;
create policy "outreaches authenticated update"
  on public.outreaches
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "outreaches authenticated delete" on public.outreaches;
create policy "outreaches authenticated delete"
  on public.outreaches
  for delete
  to authenticated
  using (true);
