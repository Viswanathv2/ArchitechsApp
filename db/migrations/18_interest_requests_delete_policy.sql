-- Allow coaches and portal administrators to permanently delete interest requests.
drop policy if exists "interest manager delete" on public.interest_submissions;
create policy "interest manager delete"
  on public.interest_submissions
  for delete
  to authenticated
  using (public.is_portal_manager());