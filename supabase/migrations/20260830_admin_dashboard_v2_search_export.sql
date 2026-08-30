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
        select count(*)
        from public.member_profiles p
        left join public.member_match_profiles v2 on v2.user_id = p.user_id
        where (
          v2.user_id is not null
          and (select count(*) from jsonb_object_keys(v2.interest_scores)) >= 2
          and exists (select 1 from jsonb_each_text(v2.interest_scores) e where e.value::numeric > 0)
          and (
            coalesce(v2.availability_randomness, 0) >= 3
            or exists (select 1 from jsonb_each_text(v2.availability_grid) a where a.value::numeric > 0)
          )
          and (v2.playstyle_preferences #>> '{paceIntensity,ideal}') is not null
          and (v2.playstyle_preferences #>> '{collabSynchrony,ideal}') is not null
          and (v2.playstyle_preferences #>> '{collabDivision,ideal}') is not null
        ) or (
          v2.user_id is null
          and p.interests is not null
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
        )
      ),
      'v2Count', (select count(*) from public.member_match_profiles),
      'enrichedCount', (
        select count(*)
        from public.member_match_profiles v2
        where (v2.boundary_preferences #>> '{groupSize,ideal}') is not null
          and (v2.boundary_preferences #>> '{duration,ideal}') is not null
          and (v2.boundary_preferences #>> '{voice,ideal}') is not null
          and (v2.boundary_preferences #>> '{asyncProgress,ideal}') is not null
          and (v2.playstyle_preferences #>> '{sessionPlanning,ideal}') is not null
          and (v2.playstyle_preferences #>> '{resourceSharing,ideal}') is not null
          and (select count(*) from jsonb_object_keys(v2.role_preferences)) >= 4
          and (v2.learning_preferences ->> 'teach') is not null
          and (v2.learning_preferences ->> 'learn') is not null
          and (v2.learning_preferences ->> 'researchIndependence') is not null
      ),
      'publicQqCount', (select count(*) from public.member_contacts where show_qq),
      'boundEmailCount', (
        select count(*)
        from public.member_profiles p
        join auth.users u on u.id = p.user_id
        where coalesce(u.is_anonymous, true) = false
      ),
      'recent7dCount', (select count(*) from public.member_profiles where created_at >= now() - interval '7 days'),
      'feedbackCount', (select count(*) from public.match_feedback where feedback is not null),
      'negativeFeedbackCount', (select count(*) from public.match_feedback where feedback = 'negative'),
      'qqCopyCount', (select count(*) from public.match_feedback where qq_copied)
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
          'publicQq', case when coalesce(c.show_qq, false) then c.qq else null end,
          'boundEmail', coalesce(u.is_anonymous, true) = false,
          'createdAt', p.created_at,
          'updatedAt', greatest(p.updated_at, coalesce(v2.updated_at, p.updated_at)),
          'completion', case
            when v2.user_id is not null then
              case
                when (select count(*) from jsonb_object_keys(v2.interest_scores)) < 2
                  or not exists (select 1 from jsonb_each_text(v2.interest_scores) e where e.value::numeric > 0) then 0
                when not (coalesce(v2.availability_randomness, 0) >= 3 or exists (select 1 from jsonb_each_text(v2.availability_grid) a where a.value::numeric > 0)) then 33
                when (v2.playstyle_preferences #>> '{paceIntensity,ideal}') is null
                  or (v2.playstyle_preferences #>> '{collabSynchrony,ideal}') is null
                  or (v2.playstyle_preferences #>> '{collabDivision,ideal}') is null then 67
                else 100
              end
            else round((
              (case when p.interests is not null then 1 else 0 end)
              + (case when p.pace is not null then 1 else 0 end)
              + (case when p.availability is not null then 1 else 0 end)
              + (case when p.duration is not null then 1 else 0 end)
              + (case when p.group_size is not null then 1 else 0 end)
              + (case when p.collaboration is not null then 1 else 0 end)
              + (case when p.roles is not null then 1 else 0 end)
              + (case when p.communication is not null then 1 else 0 end)
              + (case when p.research is not null then 1 else 0 end)
              + (case when p.session_style is not null then 1 else 0 end)
              + (case when p.resource_style is not null then 1 else 0 end)
              + (case when p.experience_style is not null then 1 else 0 end)
            )::numeric / 12 * 100)
          end,
          'profileVersion', case when v2.user_id is null then 1 else 2 end,
          'v2InterestScores', coalesce(v2.interest_scores, '{}'::jsonb),
          'v2CurrentIntents', coalesce(to_jsonb(v2.current_intents), '[]'::jsonb),
          'v2AvailabilityGrid', coalesce(v2.availability_grid, '{}'::jsonb),
          'v2AvailabilityRandomness', v2.availability_randomness,
          'v2PlaystylePreferences', coalesce(v2.playstyle_preferences, '{}'::jsonb),
          'v2RolePreferences', coalesce(v2.role_preferences, '{}'::jsonb),
          'v2BoundaryPreferences', coalesce(v2.boundary_preferences, '{}'::jsonb),
          'v2LearningPreferences', coalesce(v2.learning_preferences, '{}'::jsonb),
          'enrichmentCompletion', case when v2.user_id is null then 0 else (
            (case when (v2.boundary_preferences #>> '{groupSize,ideal}') is not null and (v2.boundary_preferences #>> '{duration,ideal}') is not null then 1 else 0 end)
            + (case when (v2.boundary_preferences #>> '{voice,ideal}') is not null and (v2.boundary_preferences #>> '{asyncProgress,ideal}') is not null and (v2.playstyle_preferences #>> '{sessionPlanning,ideal}') is not null then 1 else 0 end)
            + (case when (v2.playstyle_preferences #>> '{resourceSharing,ideal}') is not null then 1 else 0 end)
            + (case when (select count(*) from jsonb_object_keys(v2.role_preferences)) >= 4 then 1 else 0 end)
            + (case when (v2.learning_preferences ->> 'teach') is not null and (v2.learning_preferences ->> 'learn') is not null and (v2.learning_preferences ->> 'researchIndependence') is not null then 1 else 0 end)
          ) end,
          'receivedPositive', coalesce(fb.positive_count, 0),
          'receivedNeutral', coalesce(fb.neutral_count, 0),
          'receivedNegative', coalesce(fb.negative_count, 0),
          'qqCopyCount', coalesce(fb.qq_copy_count, 0)
        )
        order by greatest(p.updated_at, coalesce(v2.updated_at, p.updated_at)) desc
      )
      from public.member_profiles p
      left join public.member_contacts c on c.user_id = p.user_id
      left join auth.users u on u.id = p.user_id
      left join public.member_match_profiles v2 on v2.user_id = p.user_id
      left join lateral (
        select
          count(*) filter (where mf.feedback = 'positive') as positive_count,
          count(*) filter (where mf.feedback = 'neutral') as neutral_count,
          count(*) filter (where mf.feedback = 'negative') as negative_count,
          count(*) filter (where mf.qq_copied) as qq_copy_count
        from public.match_feedback mf
        where mf.candidate_user_id = p.user_id
      ) fb on true
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_dashboard() from public;
grant execute on function public.get_admin_dashboard() to authenticated;
