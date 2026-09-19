-- ============================================================================
-- 01_profiles_and_people.sql
-- User profiles and team people tables.
-- Includes: profiles, team_members, coaches, mentors, alumni.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Profiles / auth metadata
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null,
  is_coach          boolean not null default false,
  is_portal_admin   boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_portal_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (p.is_portal_admin = true or p.is_coach = true)
  );
$$;

grant execute on function public.is_portal_manager() to authenticated;

drop policy if exists "profiles authenticated read" on public.profiles;
create policy "profiles authenticated read"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "profiles self or manager update" on public.profiles;
create policy "profiles self or manager update"
  on public.profiles
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_portal_manager()
  )
  with check (
    user_id = auth.uid()
    or public.is_portal_manager()
  );

drop policy if exists "profiles manager delete" on public.profiles;
create policy "profiles manager delete"
  on public.profiles
  for delete
  to authenticated
  using (public.is_portal_manager());

-- ---------------------------------------------------------------------------
-- Team members
-- ---------------------------------------------------------------------------
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  roles       text,
  grade       text,
  bio         text,
  image_url   text,
  email       text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists team_members_email_idx on public.team_members (lower(email));
create index if not exists team_members_sort_order_idx on public.team_members (sort_order, created_at);

alter table public.team_members enable row level security;

drop policy if exists "team_members public read active" on public.team_members;
create policy "team_members public read active"
  on public.team_members
  for select
  using (is_active = true);

drop policy if exists "team_members authenticated read all" on public.team_members;
create policy "team_members authenticated read all"
  on public.team_members
  for select
  to authenticated
  using (true);

drop policy if exists "team_members manager insert" on public.team_members;
create policy "team_members manager insert"
  on public.team_members
  for insert
  to authenticated
  with check (public.is_portal_manager());

drop policy if exists "Members can update own row" on public.team_members;
create policy "Members can update own row"
  on public.team_members for update
  to authenticated
  using (lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Managers can update any member" on public.team_members;
create policy "Managers can update any member"
  on public.team_members for update
  to authenticated
  using (public.is_portal_manager())
  with check (public.is_portal_manager());

drop policy if exists "team_members manager delete" on public.team_members;
create policy "team_members manager delete"
  on public.team_members
  for delete
  to authenticated
  using (public.is_portal_manager());

-- ---------------------------------------------------------------------------
-- Coaches and mentors
-- ---------------------------------------------------------------------------
create table if not exists public.coaches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  bio         text,
  image_url   text,
  email       text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists coaches_email_idx on public.coaches (lower(email));
create index if not exists coaches_sort_order_idx on public.coaches (sort_order, created_at);

alter table public.coaches enable row level security;

drop policy if exists "coaches_public_read" on public.coaches;
create policy "coaches_public_read"
  on public.coaches
  for select
  using (is_active = true);

drop policy if exists "coaches_authenticated_read" on public.coaches;
create policy "coaches_authenticated_read"
  on public.coaches
  for select
  to authenticated
  using (true);

drop policy if exists "coaches_auth_write" on public.coaches;
create policy "coaches_auth_write"
  on public.coaches
  for all
  to authenticated
  using (public.is_portal_manager())
  with check (public.is_portal_manager());

create table if not exists public.mentors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  bio         text,
  image_url   text,
  email       text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists mentors_email_idx on public.mentors (lower(email));
create index if not exists mentors_sort_order_idx on public.mentors (sort_order, created_at);

alter table public.mentors enable row level security;

drop policy if exists "mentors_public_read" on public.mentors;
create policy "mentors_public_read"
  on public.mentors
  for select
  using (is_active = true);

drop policy if exists "mentors_authenticated_read" on public.mentors;
create policy "mentors_authenticated_read"
  on public.mentors
  for select
  to authenticated
  using (true);

drop policy if exists "mentors_auth_write" on public.mentors;
create policy "mentors_auth_write"
  on public.mentors
  for all
  to authenticated
  using (public.is_portal_manager())
  with check (public.is_portal_manager());

-- ---------------------------------------------------------------------------
-- Alumni
-- ---------------------------------------------------------------------------
create table if not exists public.alumni (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  year        text,
  bio         text,
  image_url   text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists alumni_sort_order_idx on public.alumni (sort_order, created_at);

alter table public.alumni enable row level security;

drop policy if exists "alumni_public_read" on public.alumni;
create policy "alumni_public_read"
  on public.alumni
  for select
  using (is_active = true);

drop policy if exists "alumni_authenticated_read" on public.alumni;
create policy "alumni_authenticated_read"
  on public.alumni
  for select
  to authenticated
  using (true);

drop policy if exists "alumni_auth_write" on public.alumni;
create policy "alumni_auth_write"
  on public.alumni
  for all
  to authenticated
  using (public.is_portal_manager())
  with check (public.is_portal_manager());
