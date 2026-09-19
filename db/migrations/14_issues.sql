-- ============================================================================
-- 14_issues.sql
-- Issues tracker: team members log CAD/Build/Code/Portfolio issues, similar
-- to the tasks table used on the Team Tasks page. Deleting an issue is a
-- soft delete (is_archived = true) so removed issues still show up in the
-- page's Archive section instead of disappearing.
-- ============================================================================

create table if not exists public.issues (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null,
  member_type   text not null default 'team_member',
  issue_title   text not null,
  issue_type    text not null default 'Build',
  notes         text,
  status        text not null default 'Open',
  opened_date   date default current_date,
  closed_date   date,
  images        jsonb not null default '[]'::jsonb,
  is_archived   boolean not null default false,
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists issues_member_lookup_idx on public.issues (member_type, member_id);
create index if not exists issues_created_at_idx on public.issues (created_at desc);
create index if not exists issues_is_archived_idx on public.issues (is_archived);

alter table public.issues enable row level security;

-- Mirrors the tasks table: fully open to authenticated users, with the
-- creator-or-admin delete rule enforced by the client (same trust model as
-- public.tasks in 04_engagement_tasks_and_notifications.sql).
drop policy if exists "issues public read" on public.issues;
create policy "issues public read"
  on public.issues
  for select
  using (true);

drop policy if exists "issues authenticated insert" on public.issues;
create policy "issues authenticated insert"
  on public.issues
  for insert
  to authenticated
  with check (true);

drop policy if exists "issues authenticated update" on public.issues;
create policy "issues authenticated update"
  on public.issues
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "issues authenticated delete" on public.issues;
create policy "issues authenticated delete"
  on public.issues
  for delete
  to authenticated
  using (true);
