-- Club Interests Matching MVP
-- Run this once in Supabase SQL Editor.

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  intro text,
  interests text[],
  pace text,
  availability text[],
  duration text,
  group_size text,
  collaboration text,
  roles text[],
  communication text,
  research text,
  discoverable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;

-- Every signed-in club visitor can read discoverable pseudonymous player profiles.
-- Do not store private contact details in this table.
drop policy if exists "Authenticated users can read discoverable profiles" on public.member_profiles;
create policy "Authenticated users can read discoverable profiles"
on public.member_profiles
for select
to authenticated
using (discoverable = true or (select auth.uid()) = user_id);

-- A member can only create their own row.
drop policy if exists "Users can create their own profile" on public.member_profiles;
create policy "Users can create their own profile"
on public.member_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- A member can only modify their own row.
drop policy if exists "Users can update their own profile" on public.member_profiles;
create policy "Users can update their own profile"
on public.member_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Optional: allow users to remove their own profile later.
drop policy if exists "Users can delete their own profile" on public.member_profiles;
create policy "Users can delete their own profile"
on public.member_profiles
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Explicit grants keep RLS in control of data access.
grant select, insert, update, delete on public.member_profiles to authenticated;
