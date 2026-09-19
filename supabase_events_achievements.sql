-- ============================================================================
-- Team Story: Event Media + Achievements (Architechs Team Portal)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Adds:
--   1. A public storage bucket "event-media" for photos & videos
--   2. event_media   -> uploaded photos/videos tagged by event type
--   3. achievements  -> per-season results (event, date, score, placement)
-- ============================================================================

-- ---- STORAGE BUCKET --------------------------------------------------------
-- Public bucket so the Team Story page can display images/videos directly.
insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

-- Anyone can read files (public gallery).
create policy "event_media_public_read"
  on storage.objects
  for select
  using (bucket_id = 'event-media');

-- Signed-in users (admins) can upload / update / delete files.
create policy "event_media_auth_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'event-media');

create policy "event_media_auth_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'event-media');

create policy "event_media_auth_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'event-media');

-- ---- EVENT MEDIA TABLE -----------------------------------------------------
create table if not exists public.event_media (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_type  text not null default 'other',  -- game | party | outreach | workout | design | other
  event_date  date,
  caption     text,
  media_url   text not null,
  media_type  text not null default 'image',  -- image | video
  storage_path text,                           -- path inside the bucket (for deletes)
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table public.event_media enable row level security;

create policy "event_media_table_public_read"
  on public.event_media
  for select
  using (true);

create policy "event_media_table_auth_write"
  on public.event_media
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- ACHIEVEMENTS TABLE ----------------------------------------------------
create table if not exists public.achievements (
  id          uuid primary key default gen_random_uuid(),
  season      text not null,                   -- e.g. "2024-25"
  event_name  text not null,
  event_date  text,                            -- free text e.g. "Dec 14, 2024"
  location    text,
  score       text,                            -- e.g. "185 pts"
  result      text,                            -- e.g. "2nd Place / Inspire Award"
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table public.achievements enable row level security;

create policy "achievements_public_read"
  on public.achievements
  for select
  using (true);

create policy "achievements_auth_write"
  on public.achievements
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- NOTE: If your existing tables use stricter RLS (e.g. coach/admin only),
-- adjust the "*_auth_write" / storage policies above to match your setup.
-- ============================================================================
