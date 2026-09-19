-- ============================================================================
-- 13_add_task_notes_column.sql
-- Add a free-form Notes field to tasks, editable via a popup on the Team
-- Tasks page (read/write for the task's owner or a coach/admin, read-only
-- for everyone else).
-- ============================================================================

alter table public.tasks add column if not exists notes text;
