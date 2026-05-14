-- 관리자: 바이브 부스트 발동 시 contribution_points 차감 없음, 포트 부족 검사 생략
-- (앱의 isAdmin 이메일과 동일해야 함)
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
  jwt_email text := auth.jwt() ->> 'email';
  db_email text;
  is_admin boolean;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select email into db_email from auth.users where id = uid;
  is_admin := lower(trim(coalesce(nullif(jwt_email, ''), db_email, ''))) = 'pwping83@gmail.com';

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

  if not is_admin and coalesce(pts, 0) < 100 then
    return json_build_object('ok', false, 'error', 'insufficient_points', 'points', pts);
  end if;

  new_until := now() + interval '48 hours';

  if is_admin then
    update profiles
    set peek_session_until = new_until
    where id = uid;
  else
    update profiles
    set
      contribution_points = contribution_points - 100,
      peek_session_until = new_until
    where id = uid;
  end if;

  return json_build_object(
    'ok', true,
    'peek_session_until', new_until,
    'points_remaining', (select contribution_points from profiles where id = uid)
  );
end;
$$;
