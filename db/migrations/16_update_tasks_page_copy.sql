-- ============================================================================
-- 16_update_tasks_page_copy.sql
-- Update saved Supabase page/menu content so database overrides match the
-- Tasks page defaults in the frontend.
-- ============================================================================

update public.portal_pages
set title = 'Tasks',
    subtitle = 'Track and manage what everyone on the team is working on',
    updated_at = now()
where slug = 'schedule';

update public.menu_items
set title = 'Tasks',
    content = 'Track and manage what everyone on the team is working on',
    updated_at = now()
where id = 'schedule';
