-- ============================================================================
-- 04_engagement_tasks_and_notifications.sql
-- Announcements, learning resources, likes, interest submissions, dismissals,
-- and team tasks.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text,
  author_id    uuid,
  author_name  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists announcements_created_at_idx on public.announcements (created_at desc);

alter table public.announcements enable row level security;

drop policy if exists "announcements read" on public.announcements;
create policy "announcements read"
  on public.announcements
  for select
  to authenticated
  using (true);

drop policy if exists "announcements manager insert" on public.announcements;
create policy "announcements manager insert"
  on public.announcements
  for insert
  to authenticated
  with check (public.is_portal_manager());

drop policy if exists "announcements manager update" on public.announcements;
create policy "announcements manager update"
  on public.announcements
  for update
  to authenticated
  using (public.is_portal_manager())
  with check (public.is_portal_manager());

drop policy if exists "announcements manager delete" on public.announcements;
create policy "announcements manager delete"
  on public.announcements
  for delete
  to authenticated
  using (public.is_portal_manager());

-- ---------------------------------------------------------------------------
-- Learning resources
-- ---------------------------------------------------------------------------
create table if not exists public.learning_resources (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  url            text,
  resource_type  text not null default 'link',
  uploader_id    uuid,
  uploader_name  text,
  uploader_email text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists learning_resources_created_at_idx on public.learning_resources (created_at desc);
create index if not exists learning_resources_uploader_idx on public.learning_resources (uploader_id, created_at desc);

alter table public.learning_resources enable row level security;

drop policy if exists "resources read" on public.learning_resources;
create policy "resources read"
  on public.learning_resources
  for select
  to authenticated
  using (true);

drop policy if exists "resources insert" on public.learning_resources;
create policy "resources insert"
  on public.learning_resources
  for insert
  to authenticated
  with check (uploader_id = auth.uid());

drop policy if exists "resources update own or manager" on public.learning_resources;
create policy "resources update own or manager"
  on public.learning_resources
  for update
  to authenticated
  using (
    uploader_id = auth.uid()
    or public.is_portal_manager()
  )
  with check (
    uploader_id = auth.uid()
    or public.is_portal_manager()
  );

drop policy if exists "resources delete own or manager" on public.learning_resources;
create policy "resources delete own or manager"
  on public.learning_resources
  for delete
  to authenticated
  using (
    uploader_id = auth.uid()
    or public.is_portal_manager()
  );

-- ---------------------------------------------------------------------------
-- Resource likes
-- ---------------------------------------------------------------------------
create table if not exists public.resource_likes (
  resource_id uuid not null references public.learning_resources(id) on delete cascade,
  user_id     uuid not null,
  created_at  timestamptz not null default now(),
  primary key (resource_id, user_id)
);

alter table public.resource_likes enable row level security;

drop policy if exists "likes read" on public.resource_likes;
create policy "likes read"
  on public.resource_likes
  for select
  to authenticated
  using (true);

drop policy if exists "likes own insert" on public.resource_likes;
create policy "likes own insert"
  on public.resource_likes
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "likes own delete" on public.resource_likes;
create policy "likes own delete"
  on public.resource_likes
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Interest submissions + notification dismissals
-- ---------------------------------------------------------------------------
create table if not exists public.interest_submissions (
  id                     uuid primary key default gen_random_uuid(),
  kind                   text not null,
  full_name              text,
  grade                  text,
  email                  text,
  phone                  text,
  intro                  text,
  heard_about            text,
  acknowledged           boolean default false,
  team_location          text,
  student_count          text,
  needs_member_support   text,
  needs_onboarding_help  text,
  additional_info        text,
  status                 text default 'New',
  coach_note             text,
  created_at             timestamptz default now()
);

alter table public.interest_submissions enable row level security;

drop policy if exists "interest public insert" on public.interest_submissions;
create policy "interest public insert"
  on public.interest_submissions
  for insert
  with check (true);

drop policy if exists "interest authenticated read" on public.interest_submissions;
create policy "interest authenticated read"
  on public.interest_submissions
  for select
  to authenticated
  using (true);

drop policy if exists "interest authenticated update" on public.interest_submissions;
create policy "interest authenticated update"
  on public.interest_submissions
  for update
  to authenticated
  using (true)
  with check (true);

create table if not exists public.notification_dismissals (
  user_id        uuid not null references auth.users(id) on delete cascade,
  notif_type     text not null default 'interest',
  submission_id  uuid not null,
  dismissed_at   timestamptz default now(),
  primary key (user_id, notif_type, submission_id)
);

alter table public.notification_dismissals enable row level security;

drop policy if exists "dismissals own read" on public.notification_dismissals;
create policy "dismissals own read"
  on public.notification_dismissals
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "dismissals own insert" on public.notification_dismissals;
create policy "dismissals own insert"
  on public.notification_dismissals
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "dismissals own delete" on public.notification_dismissals;
create policy "dismissals own delete"
  on public.notification_dismissals
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null,
  member_type text not null default 'team_member',
  task        text not null,
  start_date  date,
  end_date    date,
  status      text not null default 'Not Started',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.tasks enable row level security;

create index if not exists tasks_member_id_idx on public.tasks (member_id);
create index if not exists tasks_member_lookup_idx on public.tasks (member_type, member_id);
create index if not exists tasks_created_at_idx on public.tasks (created_at desc);

drop policy if exists "tasks public read" on public.tasks;
create policy "tasks public read"
  on public.tasks
  for select
  using (true);

drop policy if exists "tasks authenticated insert" on public.tasks;
create policy "tasks authenticated insert"
  on public.tasks
  for insert
  to authenticated
  with check (true);

drop policy if exists "tasks authenticated update" on public.tasks;
create policy "tasks authenticated update"
  on public.tasks
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "tasks authenticated delete" on public.tasks;
create policy "tasks authenticated delete"
  on public.tasks
  for delete
  to authenticated
  using (true);
