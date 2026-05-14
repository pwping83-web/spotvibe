-- 현장 제보 AI 보류(held) · 범죄·홍보 등 유형별 신고 · 5명 누적 시 이용 제한(suspended_reports)

-- user_moderation: 신고 누적 제한
alter table public.user_moderation drop constraint if exists user_moderation_status_check;
alter table public.user_moderation
  add constraint user_moderation_status_check
  check (status in ('active', 'suspended_ai', 'suspended_admin', 'suspended_reports', 'banned'));

-- spot_reports: AI 텍스트 보류
alter table public.spot_reports drop constraint if exists spot_reports_status_check;
alter table public.spot_reports
  add constraint spot_reports_status_check
  check (status in ('pending', 'verified', 'rejected', 'hidden', 'held'));

comment on column public.spot_reports.status is 'held = AI·텍스트 검토 보류, 피드 비노출 · 관리자 승인 시 verified';

-- SOS 신고 카테고리에 범죄 연계 의심 추가
alter table public.sos_signal_abuse_reports drop constraint if exists sos_signal_abuse_reports_category_check;
alter table public.sos_signal_abuse_reports
  add constraint sos_signal_abuse_reports_category_check
  check (category in ('promo_spam', 'sexual', 'fake_emergency', 'crime_related', 'other'));

-- 현장 제보·기타 콘텐츠 유형별 신고 (실시간 사진 등)
create table if not exists public.content_abuse_reports (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('spot_report', 'sos_signal')),
  content_id uuid not null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('promo_spam', 'sexual', 'crime_related', 'fake_emergency', 'other')),
  detail text,
  created_at timestamptz not null default now(),
  unique (content_type, content_id, reporter_id)
);

create index if not exists content_abuse_target_idx on public.content_abuse_reports (target_user_id);
create index if not exists content_abuse_created_idx on public.content_abuse_reports (created_at desc);

alter table public.content_abuse_reports enable row level security;

drop policy if exists "content_abuse_select_admin" on public.content_abuse_reports;
create policy "content_abuse_select_admin"
  on public.content_abuse_reports for select
  using ((select public.is_spotvibe_admin()));

-- SOS + 현장 제보 신고에서 서로 다른 신고자 수 합산 → 5명 이상이면 suspended_reports
create or replace function public.maybe_suspend_after_peer_reports(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_target is null then
    return;
  end if;

  select count(*)::int into n
  from (
    select r.reporter_id
    from public.sos_signal_abuse_reports r
    inner join public.sos_signals s on s.id = r.signal_id
    where s.user_id = p_target
    union
    select c.reporter_id
    from public.content_abuse_reports c
    where c.target_user_id = p_target
  ) u;

  if n < 5 then
    return;
  end if;

  insert into public.user_moderation (user_id, status, reason, source, updated_at)
  values (
    p_target,
    'suspended_reports',
    '이용자 신고 누적(서로 다른 ' || n::text || '명) — 관리자 검토 필요',
    'peer_reports',
    now()
  )
  on conflict (user_id) do update set
    status = case
      when user_moderation.status in ('banned', 'suspended_admin', 'suspended_ai') then user_moderation.status
      else 'suspended_reports'
    end,
    reason = case
      when user_moderation.status in ('banned', 'suspended_admin', 'suspended_ai') then user_moderation.reason
      else excluded.reason
    end,
    source = case
      when user_moderation.status in ('banned', 'suspended_admin', 'suspended_ai') then user_moderation.source
      else excluded.source
    end,
    updated_at = now();
end;
$$;

-- SOS 신고 RPC 갱신: 범죄 카테고리 + 누적 제한
create or replace function public.submit_sos_abuse_report(
  p_signal_id uuid,
  p_category text,
  p_detail text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_rep uuid := auth.uid();
begin
  if v_rep is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select user_id into v_owner from public.sos_signals where id = p_signal_id limit 1;
  if v_owner is null then
    return json_build_object('ok', false, 'error', 'signal_not_found');
  end if;
  if v_owner = v_rep then
    return json_build_object('ok', false, 'error', 'cannot_report_own');
  end if;

  if p_category not in ('promo_spam', 'sexual', 'fake_emergency', 'crime_related', 'other') then
    return json_build_object('ok', false, 'error', 'bad_category');
  end if;

  insert into public.sos_signal_abuse_reports (signal_id, reporter_id, category, detail)
  values (
    p_signal_id,
    v_rep,
    p_category,
    nullif(trim(coalesce(p_detail, '')), '')
  )
  on conflict (signal_id, reporter_id) do update
    set category = excluded.category,
        detail = excluded.detail,
        created_at = now();

  perform public.maybe_suspend_after_peer_reports(v_owner);

  return json_build_object('ok', true);
end;
$$;

-- 현장 제보 등 유형별 신고
create or replace function public.submit_content_abuse_report(
  p_content_type text,
  p_content_id uuid,
  p_category text,
  p_detail text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rep uuid := auth.uid();
  v_target uuid;
begin
  if v_rep is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_content_type not in ('spot_report', 'sos_signal') then
    return json_build_object('ok', false, 'error', 'bad_type');
  end if;

  if p_category not in ('promo_spam', 'sexual', 'crime_related', 'fake_emergency', 'other') then
    return json_build_object('ok', false, 'error', 'bad_category');
  end if;

  if p_content_type = 'spot_report' then
    select user_id into v_target from public.spot_reports where id = p_content_id limit 1;
  else
    select user_id into v_target from public.sos_signals where id = p_content_id limit 1;
  end if;

  if v_target is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_target = v_rep then
    return json_build_object('ok', false, 'error', 'cannot_report_own');
  end if;

  insert into public.content_abuse_reports (
    content_type,
    content_id,
    target_user_id,
    reporter_id,
    category,
    detail
  )
  values (
    p_content_type,
    p_content_id,
    v_target,
    v_rep,
    p_category,
    nullif(trim(coalesce(p_detail, '')), '')
  )
  on conflict (content_type, content_id, reporter_id) do update
    set category = excluded.category,
        detail = excluded.detail,
        created_at = now();

  perform public.maybe_suspend_after_peer_reports(v_target);

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.submit_content_abuse_report(text, uuid, text, text) to authenticated;

-- 보류 제보 관리자 처리
create or replace function public.admin_resolve_held_spot_report(
  p_report_id uuid,
  p_action text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
begin
  if not (select public.is_spotvibe_admin()) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_action not in ('verify', 'reject', 'hidden') then
    return json_build_object('ok', false, 'error', 'bad_action');
  end if;

  select status into st from public.spot_reports where id = p_report_id;
  if st is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if st is distinct from 'held' then
    return json_build_object('ok', false, 'error', 'not_held', 'status', st);
  end if;

  if p_action = 'verify' then
    update public.spot_reports
    set
      status = 'verified',
      ai_label = coalesce(nullif(trim(ai_label), ''), '현장 제보'),
      ai_category = coalesce(nullif(trim(ai_category), ''), 'other'),
      ai_reason = coalesce(nullif(trim(ai_reason), ''), '관리자 승인(보류 해제)')
    where id = p_report_id;
  elsif p_action = 'reject' then
    update public.spot_reports
    set
      status = 'rejected',
      ai_reason = coalesce(nullif(trim(ai_reason), ''), '관리자 반려(보류)')
    where id = p_report_id;
  else
    update public.spot_reports
    set
      status = 'hidden',
      ai_reason = coalesce(nullif(trim(ai_reason), ''), '관리자 비공개(보류)')
    where id = p_report_id;
  end if;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.admin_resolve_held_spot_report(uuid, text) to authenticated;
