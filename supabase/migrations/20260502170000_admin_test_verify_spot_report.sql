-- 관리자 테스트 지도: Edge AI 없이 본인 pending 제보를 verified로 올림(실시간 사진 피드·포인트 트리거와 동일 경로)
create or replace function public.admin_test_verify_own_spot_report(p_report_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  jwt jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  email_raw text := coalesce(
    nullif(trim(jwt ->> 'email'), ''),
    nullif(trim(jwt -> 'user_metadata' ->> 'email'), '')
  );
  is_admin boolean := lower(email_raw) = 'pwping83@gmail.com';
  r_user_id uuid;
  r_status text;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if not is_admin then
    return json_build_object('ok', false, 'error', 'not_admin');
  end if;

  select user_id, status into r_user_id, r_status
  from public.spot_reports
  where id = p_report_id;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if r_user_id is distinct from uid then
    return json_build_object('ok', false, 'error', 'not_owner');
  end if;
  if r_status is distinct from 'pending' then
    return json_build_object('ok', false, 'error', 'wrong_status', 'status', r_status);
  end if;

  update public.spot_reports
  set
    status = 'verified',
    ai_label = '현장 제보(테스트)',
    ai_category = 'other',
    ai_reason = '관리자 테스트 지도 — AI 검증 생략'
  where id = p_report_id;

  return json_build_object('ok', true, 'verified', true, 'label', '현장 제보(테스트)');
end;
$$;

revoke all on function public.admin_test_verify_own_spot_report(uuid) from public;
grant execute on function public.admin_test_verify_own_spot_report(uuid) to authenticated;
