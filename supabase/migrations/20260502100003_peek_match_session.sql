-- 골라보기: 100pt 차감 후 세션 동안 MBTI·혈액형·활동 조건으로 실제 지도 매칭에 사용 (기간은 00005에서 48h로 정의)
alter table profiles
  add column if not exists peek_session_until timestamptz;

comment on column profiles.peek_session_until is '골라보기 세션 만료 시각(UTC). 버튼으로 시작한 뒤 48시간까지 실매칭 필터 적용.';

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

revoke all on function public.start_peek_match_session() from public;
grant execute on function public.start_peek_match_session() to authenticated;
