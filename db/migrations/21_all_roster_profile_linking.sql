-- Support login/profile linking for coaches, mentors, and alumni.
alter table public.alumni add column if not exists email text;
create index if not exists alumni_email_idx on public.alumni (lower(email));

drop policy if exists "Coaches can update own row" on public.coaches;
create policy "Coaches can update own row"
  on public.coaches for update to authenticated
  using (
    nullif(trim(email), '') is not null
    and nullif(trim(auth.jwt() ->> 'email'), '') is not null
    and lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
  )
  with check (
    nullif(trim(email), '') is not null
    and nullif(trim(auth.jwt() ->> 'email'), '') is not null
    and lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
  );

drop policy if exists "Mentors can update own row" on public.mentors;
create policy "Mentors can update own row"
  on public.mentors for update to authenticated
  using (
    nullif(trim(email), '') is not null
    and nullif(trim(auth.jwt() ->> 'email'), '') is not null
    and lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
  )
  with check (
    nullif(trim(email), '') is not null
    and nullif(trim(auth.jwt() ->> 'email'), '') is not null
    and lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
  );

drop policy if exists "Alumni can update own row" on public.alumni;
create policy "Alumni can update own row"
  on public.alumni for update to authenticated
  using (
    nullif(trim(email), '') is not null
    and nullif(trim(auth.jwt() ->> 'email'), '') is not null
    and lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
  )
  with check (
    nullif(trim(email), '') is not null
    and nullif(trim(auth.jwt() ->> 'email'), '') is not null
    and lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
  );