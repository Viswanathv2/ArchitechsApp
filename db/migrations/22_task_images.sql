alter table public.tasks
  add column if not exists images jsonb not null default '[]'::jsonb;