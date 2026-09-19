-- ============================================================================
-- 03_team_story_media_and_sponsors.sql
-- Team Story media gallery, achievements, and sponsors.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sponsors
-- ---------------------------------------------------------------------------
create table if not exists public.sponsors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  website_url  text,
  logo_url     text,
  statement    text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists sponsors_sort_order_idx on public.sponsors (sort_order, created_at);

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
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_portal_admin = true or p.is_coach = true)
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_portal_admin = true or p.is_coach = true)
    )
  );

-- ---------------------------------------------------------------------------
-- Event media
-- ---------------------------------------------------------------------------
create table if not exists public.event_media (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  event_type   text not null default 'other',
  event_date   date,
  caption      text,
  media_url    text not null,
  media_type   text not null default 'image',
  storage_path text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists event_media_event_date_idx on public.event_media (event_date desc, created_at desc);
create index if not exists event_media_event_type_idx on public.event_media (event_type, event_date desc);

alter table public.event_media enable row level security;

drop policy if exists "event_media_table_public_read" on public.event_media;
create policy "event_media_table_public_read"
  on public.event_media
  for select
  using (true);

drop policy if exists "event_media_table_auth_write" on public.event_media;
create policy "event_media_table_auth_write"
  on public.event_media
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Achievements
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  id             uuid primary key default gen_random_uuid(),
  season         text not null,
  event_name     text not null,
  event_date     text,
  location       text,
  score          text,
  result         text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  media_url      text,
  media_type     text,
  storage_path   text,
  media          jsonb not null default '[]'::jsonb,
  matches_played integer,
  matches_won    integer,
  highest_score  text,
  overall_rank   text
);

create index if not exists achievements_season_idx on public.achievements (season, sort_order, created_at);

alter table public.achievements enable row level security;

drop policy if exists "achievements_public_read" on public.achievements;
create policy "achievements_public_read"
  on public.achievements
  for select
  using (true);

drop policy if exists "achievements_auth_write" on public.achievements;
create policy "achievements_auth_write"
  on public.achievements
  for all
  to authenticated
  using (true)
  with check (true);
