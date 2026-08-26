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
  session_style text,
  resource_style text,
  experience_style text,
  discoverable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep existing projects in sync when this file is re-run after new profile dimensions are added.
alter table public.member_profiles
  add column if not exists session_style text,
  add column if not exists resource_style text,
  add column if not exists experience_style text;

alter table public.member_profiles enable row level security;

drop policy if exists "Authenticated users can read discoverable profiles" on public.member_profiles;
create policy "Authenticated users can read discoverable profiles"
on public.member_profiles
for select
to authenticated
using (discoverable = true or (select auth.uid()) = user_id);

drop policy if exists "Users can create their own profile" on public.member_profiles;
create policy "Users can create their own profile"
on public.member_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.member_profiles;
create policy "Users can update their own profile"
on public.member_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own profile" on public.member_profiles;
create policy "Users can delete their own profile"
on public.member_profiles
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.member_profiles to authenticated;

-- Contact data is kept separately so a hidden QQ is protected by RLS,
-- not merely hidden by frontend code.
create table if not exists public.member_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  qq text not null check (qq ~ '^[0-9]{5,12}$'),
  show_qq boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.member_contacts enable row level security;

drop policy if exists "Users can read public or own QQ" on public.member_contacts;
create policy "Users can read public or own QQ"
on public.member_contacts
for select
to authenticated
using (show_qq = true or (select auth.uid()) = user_id);

drop policy if exists "Users can create their own contact" on public.member_contacts;
create policy "Users can create their own contact"
on public.member_contacts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own contact" on public.member_contacts;
create policy "Users can update their own contact"
on public.member_contacts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own contact" on public.member_contacts;
create policy "Users can delete their own contact"
on public.member_contacts
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.member_contacts to authenticated;
