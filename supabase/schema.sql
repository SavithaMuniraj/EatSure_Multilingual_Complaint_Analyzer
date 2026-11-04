-- Run once in Supabase SQL Editor. Username/email mappings are server-side only.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;

create or replace function public.create_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  normalized_username text := lower(trim(new.raw_user_meta_data ->> 'username'));
  normalized_email text := lower(trim(new.email));
begin
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@gmail\.com$' then
    raise exception 'Only Gmail addresses can register.';
  end if;
  if normalized_username is null or normalized_username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'Username must be 3–30 letters, numbers, or underscores.';
  end if;
  insert into public.user_profiles(user_id, username, email)
  values (new.id, normalized_username, normalized_email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_user_profile();
