-- Run in the Supabase SQL Editor to add per-account customer details.
-- Complaint descriptions and raw complaint rows stay in the existing dataset;
-- this table stores only customer-entered details and is isolated by owner_id.
create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_ref text not null check (length(customer_ref) between 1 and 100),
  display_name text check (display_name is null or length(display_name) <= 120),
  email text check (email is null or length(email) <= 254),
  phone text check (phone is null or length(phone) <= 40),
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, customer_ref)
);

alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from anon, authenticated;
grant select, insert, update, delete on public.customer_profiles to authenticated;

drop policy if exists customer_profiles_select_own on public.customer_profiles;
create policy customer_profiles_select_own on public.customer_profiles
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists customer_profiles_insert_own on public.customer_profiles;
create policy customer_profiles_insert_own on public.customer_profiles
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists customer_profiles_update_own on public.customer_profiles;
create policy customer_profiles_update_own on public.customer_profiles
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists customer_profiles_delete_own on public.customer_profiles;
create policy customer_profiles_delete_own on public.customer_profiles
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.set_customer_profile_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_customer_profile_updated_at on public.customer_profiles;
create trigger set_customer_profile_updated_at
  before update on public.customer_profiles
  for each row execute function public.set_customer_profile_updated_at();
