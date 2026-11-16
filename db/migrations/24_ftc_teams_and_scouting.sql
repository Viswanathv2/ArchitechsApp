-- FTC team directory and member-submitted scouting reports.
create table if not exists public.ftc_teams (
  id           uuid primary key default gen_random_uuid(),
  team_number  text not null unique check (btrim(team_number) <> ''),
  team_name    text not null check (btrim(team_name) <> ''),
  description  text not null default '',
  season_name  text not null default '',
  created_at   timestamptz not null default now()
);

alter table public.ftc_teams enable row level security;

drop policy if exists "ftc teams authenticated read" on public.ftc_teams;
create policy "ftc teams authenticated read"
  on public.ftc_teams
  for select
  to authenticated
  using (true);

drop policy if exists "ftc teams authenticated insert" on public.ftc_teams;
create policy "ftc teams authenticated insert"
  on public.ftc_teams
  for insert
  to authenticated
  with check (true);

drop policy if exists "ftc teams authenticated update" on public.ftc_teams;
create policy "ftc teams authenticated update"
  on public.ftc_teams
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "ftc teams authenticated delete" on public.ftc_teams;
create policy "ftc teams authenticated delete"
  on public.ftc_teams
  for delete
  to authenticated
  using (true);

grant select, insert, update, delete on table public.ftc_teams to authenticated;

create table if not exists public.ftc_scouting_entries (
  id                         uuid primary key default gen_random_uuid(),
  team_id                    uuid not null references public.ftc_teams(id) on delete restrict,
  scouted_by_id              uuid references auth.users(id) on delete set null,
  scouted_by                 text not null,
  start_position_preference  text check (start_position_preference in ('Yes', 'No')),
  preferred_start_position   text,
  has_autonomous             text check (has_autonomous in ('Yes', 'No')),
  autonomous_artifact_count  integer check (autonomous_artifact_count >= 0),
  artifact_pickup_method     text check (artifact_pickup_method in ('Floor', 'Human Player')),
  shooting_ability           text check (shooting_ability in ('Yes', 'No (push only)')),
  shooting_range             text check (shooting_range in ('Far launch zone', 'Close launch zone', 'Both')),
  motif_priority             text check (motif_priority in ('Yes', 'No')),
  can_play_defense            text check (can_play_defense in ('Yes', 'No')),
  defense_explanation        text,
  bonus_park                 text check (bonus_park in ('Yes', 'No')),
  robot_notes                text,
  distinct_robot_part        text,
  total_points               numeric check (total_points >= 0),
  total_auto_points          numeric check (total_auto_points >= 0),
  total_ranking_points       numeric check (total_ranking_points >= 0),
  alliance_penalty_total     numeric check (alliance_penalty_total >= 0),
  place_finished             text,
  played_well                text check (played_well in ('Yes', 'No')),
  created_at                 timestamptz not null default now()
);

create index if not exists ftc_scouting_entries_team_idx
  on public.ftc_scouting_entries (team_id, created_at desc);
create index if not exists ftc_scouting_entries_created_at_idx
  on public.ftc_scouting_entries (created_at desc);

alter table public.ftc_scouting_entries enable row level security;

drop policy if exists "ftc scouting authenticated read" on public.ftc_scouting_entries;
create policy "ftc scouting authenticated read"
  on public.ftc_scouting_entries
  for select
  to authenticated
  using (true);

drop policy if exists "ftc scouting members insert" on public.ftc_scouting_entries;
create policy "ftc scouting members insert"
  on public.ftc_scouting_entries
  for insert
  to authenticated
  with check (scouted_by_id = auth.uid());

grant select, insert on table public.ftc_scouting_entries to authenticated;
