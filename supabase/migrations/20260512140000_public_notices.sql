-- public_notices: 공공 API / RSS 수집 결과 저장 테이블
-- 출처: 행안부 재난문자(safetydata.go.kr), 공공데이터포털(data.go.kr) 등 허용된 공개 API
-- 수집 주체: Edge Function sync-public-notices (서버 측 배치)

create table if not exists public_notices (
  id            uuid primary key default gen_random_uuid(),

  -- 공지 분류
  source        text not null,          -- 'disaster_sms' | 'park_event' | 'safety_facility' | 'rss'
  category      text not null,          -- 'fire' | 'flood' | 'earthquake' | 'event' | 'safety' | 'general'
  region_code   text,                   -- 시도·시군구 코드 (행안부 기준, null=전국)
  region_name   text,                   -- '서울특별시 관악구' 등 표시용

  -- 내용
  title         text not null,
  body          text,
  external_url  text,                   -- 원문 링크 (있는 경우)
  issued_at     timestamptz not null,   -- 원본 발행 시각
  expires_at    timestamptz,            -- 유효 기간 (재난문자 등)

  -- 위치 (있는 경우)
  lat           double precision,
  lng           double precision,

  -- 운영
  is_active     boolean not null default true,   -- false = 관리자 숨김
  sync_batch    text,                            -- 수집 배치 ID (ISO 시각)
  raw_json      jsonb,                           -- 원본 응답 전체 (디버그용)

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 중복 수집 방지: 같은 source + issued_at + title 조합은 1건만 허용
create unique index if not exists public_notices_dedup_idx
  on public_notices (source, issued_at, title);

-- 자주 쓰는 조회 패턴
create index if not exists public_notices_source_issued_idx
  on public_notices (source, issued_at desc);

create index if not exists public_notices_active_issued_idx
  on public_notices (is_active, issued_at desc)
  where is_active = true;

create index if not exists public_notices_region_idx
  on public_notices (region_code)
  where region_code is not null;

-- updated_at 자동 갱신
create or replace function touch_public_notices_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_public_notices_updated_at on public_notices;
create trigger trg_public_notices_updated_at
  before update on public_notices
  for each row execute function touch_public_notices_updated_at();

-- sync_log: 수집 배치 이력 (관리자 대시보드용)
create table if not exists public_notices_sync_log (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  fetched_count int not null default 0,
  inserted_count int not null default 0,
  skipped_count int not null default 0,
  error_msg     text,
  status        text not null default 'running'   -- 'running' | 'ok' | 'error'
);

create index if not exists public_notices_sync_log_source_started_idx
  on public_notices_sync_log (source, started_at desc);

-- RLS: 일반 사용자 읽기 허용 (is_active=true만), 쓰기는 service_role만
alter table public_notices enable row level security;
alter table public_notices_sync_log enable row level security;

-- 일반 사용자: is_active=true인 공지만 SELECT
create policy "public_notices_select_active"
  on public_notices for select
  using (is_active = true);

-- service_role: 전체 접근 (Edge Function 전용)
create policy "public_notices_service_role_all"
  on public_notices for all
  using (auth.role() = 'service_role');

create policy "sync_log_service_role_all"
  on public_notices_sync_log for all
  using (auth.role() = 'service_role');

-- 관리자: sync_log 읽기 (pwping83@gmail.com jwt 이메일 체크)
create policy "sync_log_admin_select"
  on public_notices_sync_log for select
  using (
    (auth.jwt() ->> 'email') = 'pwping83@gmail.com'
  );

-- 관리자: is_active 토글
create policy "public_notices_admin_update"
  on public_notices for update
  using (
    (auth.jwt() ->> 'email') = 'pwping83@gmail.com'
  );
