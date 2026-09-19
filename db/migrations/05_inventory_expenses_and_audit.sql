-- ============================================================================
-- 05_inventory_expenses_and_audit.sql
-- Shared team inventory, expenses, and immutable audit history.
-- ============================================================================

create table if not exists public.parts_inventory (
  id             uuid primary key default gen_random_uuid(),
  part_name      text not null,
  description    text,
  quantity       integer not null default 1 check (quantity >= 0),
  is_lent        boolean not null default false,
  lent_to        text,
  is_in_field    boolean not null default false,
  storage_area   text,
  condition     text,
  notes          text,
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists parts_inventory_name_idx on public.parts_inventory (lower(part_name));
create index if not exists parts_inventory_updated_idx on public.parts_inventory (updated_at desc);

-- Normalize legacy rows before enforcing the mutually exclusive location states.
update public.parts_inventory
set is_in_field = false,
    lent_to = case when is_lent then lent_to else null end
where is_lent and is_in_field;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.parts_inventory'::regclass
      and conname = 'parts_inventory_lent_or_field_check'
  ) then
    alter table public.parts_inventory
      add constraint parts_inventory_lent_or_field_check
      check (not (is_lent and is_in_field));
  end if;
end;
$$;

alter table public.parts_inventory enable row level security;

drop policy if exists "parts inventory authenticated read" on public.parts_inventory;
create policy "parts inventory authenticated read"
  on public.parts_inventory for select to authenticated using (true);

drop policy if exists "parts inventory authenticated insert" on public.parts_inventory;
create policy "parts inventory authenticated insert"
  on public.parts_inventory for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "parts inventory authenticated update" on public.parts_inventory;
create policy "parts inventory authenticated update"
  on public.parts_inventory for update to authenticated
  using (true) with check (true);

drop policy if exists "parts inventory authenticated delete" on public.parts_inventory;
create policy "parts inventory authenticated delete"
  on public.parts_inventory for delete to authenticated using (true);

create table if not exists public.team_expenses (
  id             uuid primary key default gen_random_uuid(),
  description    text not null,
  amount         numeric(12, 2) not null check (amount >= 0),
  expense_date   date not null default current_date,
  category       text not null default 'Other',
  paid_by        text,
  vendor         text,
  receipt_url    text,
  notes          text,
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists team_expenses_date_idx on public.team_expenses (expense_date desc, created_at desc);
create index if not exists team_expenses_category_idx on public.team_expenses (category);

alter table public.team_expenses enable row level security;

drop policy if exists "team expenses authenticated read" on public.team_expenses;
create policy "team expenses authenticated read"
  on public.team_expenses for select to authenticated using (true);

drop policy if exists "team expenses authenticated insert" on public.team_expenses;
create policy "team expenses authenticated insert"
  on public.team_expenses for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "team expenses authenticated update" on public.team_expenses;
create policy "team expenses authenticated update"
  on public.team_expenses for update to authenticated
  using (true) with check (true);

drop policy if exists "team expenses authenticated delete" on public.team_expenses;
create policy "team expenses authenticated delete"
  on public.team_expenses for delete to authenticated using (true);

create table if not exists public.team_audit_log (
  id            bigint generated always as identity primary key,
  entity_type   text not null,
  entity_id     uuid not null,
  action        text not null check (action in ('created', 'updated', 'deleted')),
  actor_id      uuid references auth.users(id),
  actor_name    text not null default 'Unknown member',
  before_data   jsonb,
  after_data    jsonb,
  changed_at    timestamptz not null default now()
);

create index if not exists team_audit_entity_idx on public.team_audit_log (entity_type, entity_id, changed_at desc);
create index if not exists team_audit_changed_at_idx on public.team_audit_log (changed_at desc);

alter table public.team_audit_log enable row level security;

drop policy if exists "team audit authenticated read" on public.team_audit_log;
create policy "team audit authenticated read"
  on public.team_audit_log for select to authenticated using (true);

create or replace function public.record_team_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name_value text;
  entity_id_value uuid;
  before_value jsonb;
  after_value jsonb;
  action_value text;
begin
  select coalesce(nullif(p.display_name, ''), nullif(auth.jwt() ->> 'email', ''), 'Unknown member')
    into actor_name_value
  from public.profiles p
  where p.user_id = auth.uid();

  actor_name_value := coalesce(actor_name_value, nullif(auth.jwt() ->> 'email', ''), 'Unknown member');

  if tg_op = 'DELETE' then
    entity_id_value := old.id;
    before_value := to_jsonb(old);
    after_value := null;
    action_value := 'deleted';
  elsif tg_op = 'UPDATE' then
    entity_id_value := new.id;
    before_value := to_jsonb(old);
    after_value := to_jsonb(new);
    action_value := 'updated';
  else
    entity_id_value := new.id;
    before_value := null;
    after_value := to_jsonb(new);
    action_value := 'created';
  end if;

  insert into public.team_audit_log (
    entity_type, entity_id, action, actor_id, actor_name, before_data, after_data
  ) values (
    tg_argv[0], entity_id_value, action_value, auth.uid(), actor_name_value, before_value, after_value
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

grant execute on function public.record_team_audit_event() to authenticated;

drop trigger if exists parts_inventory_audit_trigger on public.parts_inventory;
create trigger parts_inventory_audit_trigger
after insert or update or delete on public.parts_inventory
for each row execute function public.record_team_audit_event('parts_inventory');

drop trigger if exists team_expenses_audit_trigger on public.team_expenses;
create trigger team_expenses_audit_trigger
after insert or update or delete on public.team_expenses
for each row execute function public.record_team_audit_event('team_expenses');
