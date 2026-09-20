-- Let portal administrators manage actual Supabase Auth users, including
-- historical accounts that do not yet have a public.profiles row.
create or replace function public.list_registered_users()
returns table (
  user_id uuid,
  display_name text,
  email text,
  created_at timestamptz,
  is_portal_admin boolean,
  is_coach boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1
    from public.profiles current_profile
    where current_profile.user_id = auth.uid()
      and current_profile.is_portal_admin = true
  ) then
    raise exception 'Portal administrator access required';
  end if;

  return query
  select
    auth_user.id,
    coalesce(
      profile.display_name,
      auth_user.raw_user_meta_data ->> 'display_name',
      split_part(auth_user.email, '@', 1),
      'Member'
    ),
    auth_user.email::text,
    auth_user.created_at,
    coalesce(profile.is_portal_admin, false),
    coalesce(profile.is_coach, false)
  from auth.users auth_user
  left join public.profiles profile on profile.user_id = auth_user.id
  order by auth_user.created_at desc;
end;
$$;

revoke all on function public.list_registered_users() from public;
grant execute on function public.list_registered_users() to authenticated;

create or replace function public.set_registered_user_role(target_user_id uuid, target_role text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  target_user auth.users%rowtype;
begin
  if not exists (
    select 1
    from public.profiles current_profile
    where current_profile.user_id = auth.uid()
      and current_profile.is_portal_admin = true
  ) then
    raise exception 'Portal administrator access required';
  end if;

  if target_role not in ('member', 'coach', 'admin') then
    raise exception 'Invalid role';
  end if;

  select * into target_user from auth.users where id = target_user_id;
  if not found then
    raise exception 'Registered user not found';
  end if;

  insert into public.profiles (
    user_id,
    display_name,
    is_portal_admin,
    is_coach,
    created_at,
    updated_at
  ) values (
    target_user.id,
    coalesce(
      target_user.raw_user_meta_data ->> 'display_name',
      split_part(target_user.email, '@', 1),
      'Member'
    ),
    target_role = 'admin',
    target_role = 'coach',
    coalesce(target_user.created_at, now()),
    now()
  )
  on conflict (user_id) do update
  set is_portal_admin = excluded.is_portal_admin,
      is_coach = excluded.is_coach,
      updated_at = now();
end;
$$;

revoke all on function public.set_registered_user_role(uuid, text) from public;
grant execute on function public.set_registered_user_role(uuid, text) to authenticated;