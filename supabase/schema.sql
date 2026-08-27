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

-- Admin access is email allowlisted and checked inside SECURITY DEFINER functions.
-- The dashboard deliberately returns only whether QQ is public, never a hidden QQ number.
create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;
revoke all on public.admin_allowlist from anon, authenticated;

insert into public.admin_allowlist (email)
values ('ruihaotan@outlook.com')
on conflict (email) do nothing;

create or replace function public.is_club_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_allowlist a
    where lower(a.email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

revoke all on function public.is_club_admin() from public;
grant execute on function public.is_club_admin() to authenticated;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_club_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'stats', jsonb_build_object(
      'profileCount', (select count(*) from public.member_profiles),
      'discoverableCount', (select count(*) from public.member_profiles where discoverable),
      'completeCount', (
        select count(*) from public.member_profiles p
        where p.interests is not null
          and p.pace is not null
          and p.availability is not null
          and p.duration is not null
          and p.group_size is not null
          and p.collaboration is not null
          and p.roles is not null
          and p.communication is not null
          and p.research is not null
          and p.session_style is not null
          and p.resource_style is not null
          and p.experience_style is not null
      ),
      'publicQqCount', (select count(*) from public.member_contacts where show_qq),
      'boundEmailCount', (
        select count(*)
        from public.member_profiles p
        join auth.users u on u.id = p.user_id
        where coalesce(u.is_anonymous, true) = false
      ),
      'recent7dCount', (
        select count(*) from public.member_profiles
        where created_at >= now() - interval '7 days'
      )
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.user_id,
          'name', p.display_name,
          'intro', coalesce(p.intro, ''),
          'interests', coalesce(to_jsonb(p.interests), '[]'::jsonb),
          'pace', p.pace,
          'availability', coalesce(to_jsonb(p.availability), '[]'::jsonb),
          'duration', p.duration,
          'groupSize', p.group_size,
          'collaboration', p.collaboration,
          'roles', coalesce(to_jsonb(p.roles), '[]'::jsonb),
          'communication', p.communication,
          'research', p.research,
          'sessionStyle', p.session_style,
          'resourceStyle', p.resource_style,
          'experienceStyle', p.experience_style,
          'discoverable', p.discoverable,
          'showQq', coalesce(c.show_qq, false),
          'boundEmail', coalesce(u.is_anonymous, true) = false,
          'createdAt', p.created_at,
          'updatedAt', p.updated_at,
          'completion', round((
            (
              case when p.interests is not null then 1 else 0 end +
              case when p.pace is not null then 1 else 0 end +
              case when p.availability is not null then 1 else 0 end +
              case when p.duration is not null then 1 else 0 end +
              case when p.group_size is not null then 1 else 0 end +
              case when p.collaboration is not null then 1 else 0 end +
              case when p.roles is not null then 1 else 0 end +
              case when p.communication is not null then 1 else 0 end +
              case when p.research is not null then 1 else 0 end +
              case when p.session_style is not null then 1 else 0 end +
              case when p.resource_style is not null then 1 else 0 end +
              case when p.experience_style is not null then 1 else 0 end
            )::numeric / 12
          ) * 100)
        )
        order by p.updated_at desc
      )
      from public.member_profiles p
      left join public.member_contacts c on c.user_id = p.user_id
      left join auth.users u on u.id = p.user_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_dashboard() from public;
grant execute on function public.get_admin_dashboard() to authenticated;