-- ============================================================================
-- 12_add_task_hours_column.sql
-- Add an optional "No Of Hours" field to tasks, shown as a column on the
-- Team Tasks page.
-- ============================================================================

alter table public.tasks add column if not exists hours numeric;
