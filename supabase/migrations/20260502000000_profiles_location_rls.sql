-- profiles 테이블 생성 (없으면) + 위치·필터 컬럼 추가
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 위치 컬럼
alter table profiles add column if not exists explore_lat  double precision;
alter table profiles add column if not exists explore_lng  double precision;
alter table profiles add column if not exists location_mode text default 'my_location';

-- 프로필 필터 컬럼
alter table profiles add column if not exists age_range         text;
alter table profiles add column if not exists gender            text;
alter table profiles add column if not exists mobility_profile  text default 'pedestrian_ddareungi';
alter table profiles add column if not exists mbti_types        text[] default '{}';
alter table profiles add column if not exists blood_types       text[] default '{}';
alter table profiles add column if not exists gender_crowd_pref text default 'all';
alter table profiles add column if not exists activity_tags     text[] default '{}';

-- 알림/설정 컬럼
alter table profiles add column if not exists notification_weekdays   integer[] default '{}';
alter table profiles add column if not exists notification_time_slots text[]    default '{}';
alter table profiles add column if not exists ai_notifications_paused boolean   default false;

-- updated_at 자동 갱신
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- RLS 활성화
alter table profiles enable row level security;

-- 자신의 행 전체 조작 허용
drop policy if exists "own profile" on profiles;
create policy "own profile"
  on profiles for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- 다른 사용자 위치·필터 읽기 허용 (매칭 쿼리에 필요)
-- 단, 민감 필드(id 제외 식별 정보 없음)만 노출
drop policy if exists "read others location and filters" on profiles;
create policy "read others location and filters"
  on profiles for select
  using (
    auth.uid() is not null         -- 로그인한 사용자만
    and explore_lat is not null    -- 위치를 공유한 사용자만
    and explore_lng is not null
  );
