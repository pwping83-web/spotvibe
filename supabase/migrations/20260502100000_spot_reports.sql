-- spot_reports: 사용자 현장 제보 테이블
create table if not exists spot_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  photo_url    text not null,
  lat          double precision not null,
  lng          double precision not null,
  -- pending: AI 검증 대기 | verified: 유효한 현장 사진 | rejected: 무관한 사진
  status       text not null default 'pending'
               check (status in ('pending', 'verified', 'rejected')),
  ai_label     text,       -- AI가 붙인 이벤트 이름 (e.g. "버스킹", "플리마켓")
  ai_category  text,       -- 'performance' | 'market' | 'crowd' | 'other'
  ai_reason    text,       -- AI 판단 근거 한 줄 요약
  place_name   text,
  description  text,
  created_at   timestamptz not null default now()
);

-- 인덱스: 위치 기반 클러스터링 쿼리 최적화
create index if not exists spot_reports_lat_lng_idx
  on spot_reports (lat, lng);

create index if not exists spot_reports_status_created_idx
  on spot_reports (status, created_at desc);

-- RLS
alter table spot_reports enable row level security;

-- 로그인 사용자는 verified 제보를 모두 읽을 수 있음
create policy "read verified reports"
  on spot_reports for select
  to authenticated
  using (status = 'verified');

-- 본인 제보는 pending 포함 모두 읽기 가능
create policy "read own reports"
  on spot_reports for select
  to authenticated
  using (user_id = auth.uid());

-- 로그인 사용자는 본인 제보 insert 가능
create policy "insert own report"
  on spot_reports for insert
  to authenticated
  with check (user_id = auth.uid());

-- 본인 제보만 삭제 가능
create policy "delete own report"
  on spot_reports for delete
  to authenticated
  using (user_id = auth.uid());

-- Edge Function(service role)이 status/ai 필드를 업데이트할 수 있음
-- service_role은 RLS 우회하므로 별도 정책 불필요
