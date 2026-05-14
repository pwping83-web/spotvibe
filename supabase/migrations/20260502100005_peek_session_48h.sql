-- 골라보기: 버튼을 누른 시점부터 48시간 동안 MBTI·혈액형·활동 필터가 실매칭에 반영
create or replace function public.start_peek_match_session()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pts int;
  cur_until timestamptz;
  new_until timestamptz;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select contribution_points, peek_session_until
  into pts, cur_until
  from profiles
  where id = uid
  for update;

  if not found then
    return json_build_object('ok', false, 'error', 'no_profile');
  end if;

  if cur_until is not null and cur_until > now() then
    return json_build_object(
      'ok', false,
      'error', 'already_active',
      'peek_session_until', cur_until
    );
  end if;

  if coalesce(pts, 0) < 100 then
    return json_build_object('ok', false, 'error', 'insufficient_points', 'points', pts);
  end if;

  new_until := now() + interval '48 hours';

  update profiles
  set
    contribution_points = contribution_points - 100,
    peek_session_until = new_until
  where id = uid;

  return json_build_object(
    'ok', true,
    'peek_session_until', new_until,
    'points_remaining', (select contribution_points from profiles where id = uid)
  );
end;
$$;

comment on column public.profiles.peek_session_until is '골라보기 세션 만료 시각(UTC). 버튼으로 시작한 뒤 48시간까지 MBTI·혈액형·활동 필터가 실매칭에 적용.';
