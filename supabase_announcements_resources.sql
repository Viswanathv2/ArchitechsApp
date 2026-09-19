-- ============================================================================
-- Announcements  +  Learning Resources  +  Resource likes
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- Adds:
--   1. announcements          -> coach/admin post; all logged-in members read.
--   2. learning_resources     -> any member uploads docs/videos/links.
--   3. resource_likes         -> per-user like/unlike on a resource.
--   4. Generalizes notification_dismissals so it can also clear announcement
--      notifications (not just interest submissions).
--
-- Files/videos are stored in the existing public "event-media" bucket under a
-- "resources/" folder, so no new bucket is required.
-- ============================================================================

-- ---- helper: is the current user a coach or portal admin? -----------------
-- (inlined in policies below; kept as comment for clarity)

-- ---- 1. Announcements ------------------------------------------------------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text,
  author_id    uuid,
  author_name  text,
  created_at   timestamptz default now()
);

alter table public.announcements enable row level security;

-- Any signed-in member may read announcements.
drop policy if exists "announcements read" on public.announcements;
create policy "announcements read"
  on public.announcements for select
  to authenticated
  using (true);

-- Only coaches / portal admins may create announcements.
drop policy if exists "announcements manager insert" on public.announcements;
create policy "announcements manager insert"
  on public.announcements for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_portal_admin = true or p.is_coach = true)
    )
  );

-- Only coaches / portal admins may edit or delete announcements.
drop policy if exists "announcements manager update" on public.announcements;
create policy "announcements manager update"
  on public.announcements for update
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

drop policy if exists "announcements manager delete" on public.announcements;
create policy "announcements manager delete"
  on public.announcements for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_portal_admin = true or p.is_coach = true)
    )
  );

-- ---- 2. Learning resources -------------------------------------------------
create table if not exists public.learning_resources (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  url            text,
  resource_type  text default 'link',   -- 'document' | 'video' | 'link'
  uploader_id    uuid,
  uploader_name  text,
  uploader_email text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.learning_resources enable row level security;

-- Any signed-in member may read resources.
drop policy if exists "resources read" on public.learning_resources;
create policy "resources read"
  on public.learning_resources for select
  to authenticated
  using (true);

-- Any signed-in member may add a resource (recorded as the uploader).
drop policy if exists "resources insert" on public.learning_resources;
create policy "resources insert"
  on public.learning_resources for insert
  to authenticated
  with check (uploader_id = auth.uid());

-- The uploader OR a coach/admin may edit a resource.
drop policy if exists "resources update own or manager" on public.learning_resources;
create policy "resources update own or manager"
  on public.learning_resources for update
  to authenticated
  using (
    uploader_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_portal_admin = true or p.is_coach = true)
    )
  )
  with check (
    uploader_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_portal_admin = true or p.is_coach = true)
    )
  );

-- The uploader OR a coach/admin may delete a resource.
drop policy if exists "resources delete own or manager" on public.learning_resources;
create policy "resources delete own or manager"
  on public.learning_resources for delete
  to authenticated
  using (
    uploader_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_portal_admin = true or p.is_coach = true)
    )
  );

-- ---- 3. Resource likes -----------------------------------------------------
create table if not exists public.resource_likes (
  resource_id uuid not null references public.learning_resources(id) on delete cascade,
  user_id     uuid not null,
  created_at  timestamptz default now(),
  primary key (resource_id, user_id)
);

alter table public.resource_likes enable row level security;

-- Everyone signed in can read likes (to show counts).
drop policy if exists "likes read" on public.resource_likes;
create policy "likes read"
  on public.resource_likes for select
  to authenticated
  using (true);

-- A user may like (insert) only as themselves.
drop policy if exists "likes own insert" on public.resource_likes;
create policy "likes own insert"
  on public.resource_likes for insert
  to authenticated
  with check (user_id = auth.uid());

-- A user may unlike (delete) only their own like.
drop policy if exists "likes own delete" on public.resource_likes;
create policy "likes own delete"
  on public.resource_likes for delete
  to authenticated
  using (user_id = auth.uid());

-- ---- 4. Generalize notification_dismissals ---------------------------------
-- Allow the same dismissals table to clear announcement notifications too.
-- 'notif_type' distinguishes which kind the dismissed id belongs to. Ids are
-- globally-unique uuids, so the existing (user_id, submission_id) primary key
-- still guarantees uniqueness across types.
alter table public.notification_dismissals
  add column if not exists notif_type text not null default 'interest';

-- Drop the strict FK so announcement ids can also be stored here.
alter table public.notification_dismissals
  drop constraint if exists notification_dismissals_submission_id_fkey;
