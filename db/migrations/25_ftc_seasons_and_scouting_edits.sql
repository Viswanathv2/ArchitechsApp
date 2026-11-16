-- Store reusable season options and allow signed-in members to edit scouting reports.
create table if not exists public.ftc_seasons (
  id           uuid primary key default gen_random_uuid(),
  season_name  text not null unique check (btrim(season_name) <> ''),
  created_at   timestamptz not null default now()
);

create unique index if not exists ftc_seasons_name_ci_idx
  on public.ftc_seasons (lower(btrim(season_name)));

alter table public.ftc_seasons enable row level security;

drop policy if exists "ftc seasons authenticated read" on public.ftc_seasons;
create policy "ftc seasons authenticated read"
  on public.ftc_seasons
  for select
  to authenticated
  using (true);

drop policy if exists "ftc seasons authenticated insert" on public.ftc_seasons;
create policy "ftc seasons authenticated insert"
  on public.ftc_seasons
  for insert
  to authenticated
  with check (true);

grant select, insert on table public.ftc_seasons to authenticated;

insert into public.ftc_seasons (season_name)
select distinct on (lower(btrim(season_name))) btrim(season_name)
from public.ftc_teams
where btrim(season_name) <> ''
order by lower(btrim(season_name)), btrim(season_name)
on conflict (season_name) do nothing;

drop policy if exists "ftc scouting authenticated update" on public.ftc_scouting_entries;
create policy "ftc scouting authenticated update"
  on public.ftc_scouting_entries
  for update
  to authenticated
  using (true)
  with check (true);

revoke update on table public.ftc_scouting_entries from authenticated;
grant update (
  start_position_preference,
  preferred_start_position,
  has_autonomous,
  autonomous_artifact_count,
  artifact_pickup_method,
  shooting_ability,
  shooting_range,
  motif_priority,
  can_play_defense,
  defense_explanation,
  bonus_park,
  robot_notes,
  distinct_robot_part,
  total_points,
  total_auto_points,
  total_ranking_points,
  alliance_penalty_total,
  place_finished,
  played_well
) on table public.ftc_scouting_entries to authenticated;
