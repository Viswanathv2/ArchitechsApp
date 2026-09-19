-- ============================================================================
-- 00_extensions_and_storage.sql
-- Shared prerequisites for the Architechs Team Portal database.
-- Run first when moving to a fresh database.
-- ============================================================================

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

drop policy if exists "event_media_public_read" on storage.objects;
create policy "event_media_public_read"
  on storage.objects
  for select
  using (bucket_id = 'event-media');

drop policy if exists "event_media_auth_insert" on storage.objects;
create policy "event_media_auth_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'event-media');

drop policy if exists "event_media_auth_update" on storage.objects;
create policy "event_media_auth_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'event-media');

drop policy if exists "event_media_auth_delete" on storage.objects;
create policy "event_media_auth_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'event-media');
