-- MTD Mining System database setup
-- Run this entire file in Supabase Dashboard -> SQL Editor -> New query.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  points bigint not null default 0 check (points >= 0),
  last_mined_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user can read only their own profile.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

-- Do not allow browsers to directly insert or change points/timestamps.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

-- Create the profile automatically when Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Atomically award 10 points. The database clock and row lock enforce
-- the 12-hour cooldown even if the user changes their device clock.
create or replace function public.start_mining()
returns table(points bigint, last_mined_at timestamptz, next_mining_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_last timestamptz;
  v_points bigint;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_user_id is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  select p.last_mined_at, p.points
    into v_last, v_points
    from public.profiles p
    where p.id = v_user_id
    for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_last is not null and v_last > v_now - interval '12 hours' then
    raise exception 'COOLDOWN_ACTIVE';
  end if;

  update public.profiles p
     set points = p.points + 10,
         last_mined_at = v_now
   where p.id = v_user_id
   returning p.points, p.last_mined_at
        into v_points, v_last;

  return query select v_points, v_last, v_last + interval '12 hours';
end;
$$;

revoke all on function public.start_mining() from public, anon;
grant execute on function public.start_mining() to authenticated;
