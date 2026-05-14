-- 마이그레이션 이전에 들어간 행 등: 자동 승인 직전에 금지어 한 번 더 검사
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
  r_place text;
  r_desc text;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select user_id, status, place_name, description into r_user_id, r_status, r_place, r_desc
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

  if trim(coalesce(r_place, '')) = '' then
    update public.spot_reports
    set
      status = 'rejected',
      ai_label = null,
      ai_category = 'other',
      ai_reason = '장소 이름(제목)이 필요해요.'
    where id = p_report_id
      and status = 'pending';

    return json_build_object('ok', false, 'error', 'title_required');
  end if;

  if public.spot_reports_text_is_blocked(r_place, r_desc) then
    update public.spot_reports
    set
      status = 'rejected',
      ai_label = null,
      ai_category = 'other',
      ai_reason = '제목·설명에 부적절한 표현이 포함됐어요.'
    where id = p_report_id
      and status = 'pending';

    return json_build_object('ok', false, 'error', 'blocked_text');
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
