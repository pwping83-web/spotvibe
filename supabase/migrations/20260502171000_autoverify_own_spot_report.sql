-- 제보 확정: 외부 AI 없이 본인 pending → verified (앱은 이 RPC만 호출)
drop function if exists public.admin_test_verify_own_spot_report(uuid);

create or replace function public.autoverify_own_spot_report(p_report_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r_user_id uuid;
  r_status text;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
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
    ai_label = '현장 제보',
    ai_category = 'other',
    ai_reason = '자동 등록(AI 미사용)'
  where id = p_report_id;

  return json_build_object('ok', true, 'verified', true, 'label', '현장 제보');
end;
$$;

revoke all on function public.autoverify_own_spot_report(uuid) from public;
grant execute on function public.autoverify_own_spot_report(uuid) to authenticated;
