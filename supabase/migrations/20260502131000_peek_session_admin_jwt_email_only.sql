-- auth.users 직접 조회는 일부 프로젝트에서 권한/소유자 설정에 따라 실패할 수 있음 → JWT만으로 관리자 판별
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
  jwt jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  email_raw text := coalesce(
    nullif(trim(jwt ->> 'email'), ''),
    nullif(trim(jwt -> 'user_metadata' ->> 'email'), '')
  );
  is_admin boolean := lower(email_raw) = 'pwping83@gmail.com';
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
