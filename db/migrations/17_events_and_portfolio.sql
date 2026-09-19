-- ============================================================================
-- 17_events_and_portfolio.sql
-- Team events and versioned portfolio document management.
-- ============================================================================

create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  event_name     text not null,
  event_type     text not null default 'Other',
  address        text,
  event_date     date not null,
  notes          text,
  added_by       text not null,
  member_ids     uuid[] not null default '{}',
  created_at     timestamptz not null default now()
);

create index if not exists events_event_date_idx on public.events (event_date, created_at desc);

alter table public.events enable row level security;
drop policy if exists "events authenticated read" on public.events;
create policy "events authenticated read" on public.events for select to authenticated using (true);
drop policy if exists "events authenticated write" on public.events;
create policy "events authenticated write" on public.events for all to authenticated using (true) with check (true);

create table if not exists public.portfolio_documents (
  id             uuid primary key default gen_random_uuid(),
  document_name  text not null,
  document_url   text not null,
  storage_path   text,
  original_filename text,
  version        integer not null default 1,
  added_by       text not null,
  document_date  date not null default current_date,
  notes          text,
  working_by     text,
  created_at     timestamptz not null default now()
);

create index if not exists portfolio_documents_created_at_idx on public.portfolio_documents (created_at desc);

alter table public.portfolio_documents enable row level security;
drop policy if exists "portfolio authenticated read" on public.portfolio_documents;
create policy "portfolio authenticated read" on public.portfolio_documents for select to authenticated using (true);
drop policy if exists "portfolio authenticated write" on public.portfolio_documents;
create policy "portfolio authenticated write" on public.portfolio_documents for all to authenticated using (true) with check (true);

-- Existing installations need this column too.
alter table public.portfolio_documents add column if not exists original_filename text;
