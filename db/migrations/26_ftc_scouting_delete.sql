-- Allow authenticated team members to remove scouting reports.
drop policy if exists "ftc scouting authenticated delete" on public.ftc_scouting_entries;
create policy "ftc scouting authenticated delete"
  on public.ftc_scouting_entries
  for delete
  to authenticated
  using (true);

grant delete on table public.ftc_scouting_entries to authenticated;
