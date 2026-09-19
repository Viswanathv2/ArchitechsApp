-- ============================================================================
-- Coaches & Mentors tables for the Architechs Team Portal
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- The shape mirrors the existing `alumni` table so the Team page and admin
-- dashboard behave identically.
-- ============================================================================

-- ---- COACHES ---------------------------------------------------------------
create table if not exists public.coaches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  image_url   text,
  bio         text,
  is_active   boolean default true,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table public.coaches enable row level security;

-- Public visitors can read active coaches (matches the public Team page).
create policy "coaches_public_read"
  on public.coaches
  for select
  using (true);

-- Signed-in users can manage coaches (matches your admin dashboard).
create policy "coaches_auth_write"
  on public.coaches
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- MENTORS ---------------------------------------------------------------
create table if not exists public.mentors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  image_url   text,
  bio         text,
  is_active   boolean default true,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table public.mentors enable row level security;

create policy "mentors_public_read"
  on public.mentors
  for select
  using (true);

create policy "mentors_auth_write"
  on public.mentors
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- NOTE: If your existing `alumni` table uses different RLS policies, adjust the
-- policies above to match so coaches/mentors follow the same access rules.
-- ============================================================================
