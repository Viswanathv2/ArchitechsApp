-- ============================================================================
-- 02_portal_content_and_tracking.sql
-- Portal page content, nav tiles, page visit tracking, and visitor feedback.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Portal pages
-- ---------------------------------------------------------------------------
create table if not exists public.portal_pages (
  slug           text primary key,
  title          text,
  subtitle       text,
  body           text,
  contact_email  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.portal_pages enable row level security;

drop policy if exists "portal_pages public read" on public.portal_pages;
create policy "portal_pages public read"
  on public.portal_pages
  for select
  using (true);

drop policy if exists "portal_pages manager write" on public.portal_pages;
create policy "portal_pages manager write"
  on public.portal_pages
  for all
  to authenticated
  using (public.is_portal_manager())
  with check (public.is_portal_manager());

insert into public.portal_pages (slug, title, subtitle, body, contact_email)
values
  ('home', 'FTC Team Portal', 'Welcome to Team 25795 - Architechs', 'We are Team 25795 Architechs from Mechanicsburg, Pennsylvania.', null),
  ('about', 'Our Journey', 'How Architechs grew through robotics', 'Share your team story and milestones here.', null),
  ('team', 'Team Members', 'Team 25795 - Architechs', 'Introduce your team members here.', null),
  ('schedule', 'Tasks', 'Upcoming plans for Team 25795', 'Add your meeting schedule, competitions, and build sessions.', null),
  ('resources', 'Latest Updates', 'Helpful materials for our team and visitors', 'Post announcements and learning resources here.', null),
  ('sponsorship', 'Sponsors', 'Our Supporters', 'Architechs is powered by the generosity of our sponsors. Their investment funds components, travel, registration fees, and our outreach programs.', 'viswanathv2@gmail.com'),
  ('feedback', 'Feedback', 'Share your thoughts about Team 25795 - Architechs', 'We welcome feedback from team members, visitors, sponsors, and community members!', null),
  ('join', 'FTC Team Interest Form', 'Thank you for your interest in the FTC team. Please choose the option below that best matches your current need.', null, null)
on conflict (slug) do update
set title = excluded.title,
    subtitle = excluded.subtitle,
    body = excluded.body,
    contact_email = excluded.contact_email,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Menu items for the logged-in dashboard
-- ---------------------------------------------------------------------------
create table if not exists public.menu_items (
  id          text primary key,
  title       text not null,
  content     text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.menu_items enable row level security;

drop policy if exists "menu_items authenticated read" on public.menu_items;
create policy "menu_items authenticated read"
  on public.menu_items
  for select
  to authenticated
  using (true);

drop policy if exists "menu_items manager write" on public.menu_items;
create policy "menu_items manager write"
  on public.menu_items
  for all
  to authenticated
  using (public.is_portal_manager())
  with check (public.is_portal_manager());

insert into public.menu_items (id, title, content, sort_order)
values
  ('announcements', 'Announcements', 'Coach notes, meeting reminders, and tournament updates go here.', 1),
  ('schedule', 'Tasks', 'Track and manage what everyone on the team is working on', 2),
  ('resources', 'Learning Resources', 'Put links to tutorial videos, docs, and checklists here.', 3),
  ('checklist', 'Competition Checklist', 'List what to pack before leaving: battery charger, spare parts, and notebook.', 4)
on conflict (id) do update
set title = excluded.title,
    content = excluded.content,
    sort_order = excluded.sort_order,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Page visits analytics
-- ---------------------------------------------------------------------------
create table if not exists public.page_visits (
  id           uuid primary key default gen_random_uuid(),
  page_slug    text not null,
  visitor_id   text not null,
  visit_date   date not null,
  visited_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (visitor_id, page_slug, visit_date)
);

create index if not exists page_visits_page_slug_idx on public.page_visits (page_slug);
create index if not exists page_visits_visit_date_idx on public.page_visits (visit_date);
create index if not exists page_visits_visited_at_idx on public.page_visits (visited_at);

alter table public.page_visits enable row level security;

drop policy if exists "page_visits public insert" on public.page_visits;
create policy "page_visits public insert"
  on public.page_visits
  for insert
  with check (true);

drop policy if exists "page_visits authenticated read" on public.page_visits;
create policy "page_visits authenticated read"
  on public.page_visits
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Visitor feedback
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  page_slug    text not null default 'general',
  name         text not null,
  email        text,
  comment      text not null,
  is_approved  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists feedback_page_slug_idx on public.feedback (page_slug);
create index if not exists feedback_approved_idx on public.feedback (is_approved, created_at);

alter table public.feedback enable row level security;

drop policy if exists "feedback_public_read_approved" on public.feedback;
create policy "feedback_public_read_approved"
  on public.feedback
  for select
  using (is_approved = true);

drop policy if exists "feedback_auth_read_all" on public.feedback;
create policy "feedback_auth_read_all"
  on public.feedback
  for select
  to authenticated
  using (true);

drop policy if exists "feedback_public_insert" on public.feedback;
create policy "feedback_public_insert"
  on public.feedback
  for insert
  with check (true);

drop policy if exists "feedback_manager_update" on public.feedback;
create policy "feedback_manager_update"
  on public.feedback
  for update
  to authenticated
  using (public.is_portal_manager())
  with check (public.is_portal_manager());

drop policy if exists "feedback_manager_delete" on public.feedback;
create policy "feedback_manager_delete"
  on public.feedback
  for delete
  to authenticated
  using (public.is_portal_manager());
