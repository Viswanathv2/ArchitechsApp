-- ============================================================================
-- Sponsors + Achievement media (Architechs Team Portal)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Adds:
--   1. sponsors                -> current sponsors shown on the Sponsors page
--   2. achievements.media_*    -> optional photo/video shown on hover
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---- 1. SPONSORS -----------------------------------------------------------
create table if not exists public.sponsors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  website_url  text,
  logo_url     text,
  statement    text,                 -- a nice line about the sponsor
  sort_order   integer default 0,    -- controls display order (lower = first)
  created_at   timestamptz default now()
);

alter table public.sponsors enable row level security;

drop policy if exists "sponsors_public_read" on public.sponsors;
create policy "sponsors_public_read"
  on public.sponsors
  for select
  using (true);

drop policy if exists "sponsors_auth_write" on public.sponsors;
create policy "sponsors_auth_write"
  on public.sponsors
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- 2. ACHIEVEMENT MEDIA (optional) ---------------------------------------
-- Single-media columns (kept for backward compatibility) ...
alter table public.achievements
  add column if not exists media_url    text,
  add column if not exists media_type   text,   -- image | video
  add column if not exists storage_path text;    -- path inside event-media bucket

-- ... plus a media array so an achievement can have MANY photos/videos.
-- Each element: { "url": "...", "type": "image|video", "path": "achievements/..." }
alter table public.achievements
  add column if not exists media jsonb not null default '[]'::jsonb;

-- One-time backfill: copy any existing single media into the new array.
update public.achievements
set media = jsonb_build_array(
  jsonb_build_object('url', media_url, 'type', coalesce(media_type, 'image'), 'path', storage_path)
)
where media_url is not null
  and (media is null or media = '[]'::jsonb);

-- ============================================================================
