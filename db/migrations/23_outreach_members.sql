-- Track team members who participated in an outreach and save roster edits
-- atomically with the outreach's editable fields.
create table if not exists public.outreach_members (
  outreach_id uuid not null references public.outreaches(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (outreach_id, member_id)
);

create index if not exists outreach_members_member_id_idx
  on public.outreach_members (member_id);

alter table public.outreach_members enable row level security;

drop policy if exists "outreach_members public read" on public.outreach_members;
create policy "outreach_members public read"
  on public.outreach_members
  for select
  using (true);

drop policy if exists "outreach_members authenticated insert" on public.outreach_members;
create policy "outreach_members authenticated insert"
  on public.outreach_members
  for insert
  to authenticated
  with check (true);

drop policy if exists "outreach_members authenticated delete" on public.outreach_members;
create policy "outreach_members authenticated delete"
  on public.outreach_members
  for delete
  to authenticated
  using (true);

grant select on table public.outreach_members to anon, authenticated;
grant insert, delete on table public.outreach_members to authenticated;

insert into public.outreach_members (outreach_id, member_id)
select id, member_id
from public.outreaches
where member_type = 'team_member'
on conflict (outreach_id, member_id) do nothing;

create or replace function public.update_outreach_with_members(
  p_outreach_id uuid,
  p_outreach_name text,
  p_outreach_type text,
  p_outreach_date date,
  p_hours numeric,
  p_member_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  update public.outreaches
  set outreach_name = p_outreach_name,
      outreach_type = p_outreach_type,
      outreach_date = p_outreach_date,
      hours = p_hours
  where id = p_outreach_id;

  if not found then
    raise exception 'Outreach could not be updated';
  end if;

  delete from public.outreach_members
  where outreach_id = p_outreach_id;

  insert into public.outreach_members (outreach_id, member_id)
  select p_outreach_id, selected.member_id
  from (
    select distinct unnest(coalesce(p_member_ids, '{}'::uuid[])) as member_id
  ) as selected
  where selected.member_id is not null;
end;
$$;

revoke all on function public.update_outreach_with_members(uuid, text, text, date, numeric, uuid[]) from public;
grant execute on function public.update_outreach_with_members(uuid, text, text, date, numeric, uuid[]) to authenticated;
