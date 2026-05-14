-- 마지막 위치 갱신 시각 컬럼 추가
-- 5분 이상 미갱신 사용자는 "이미 이동한 것"으로 간주해 지도에서 제거
alter table profiles
  add column if not exists last_seen_at timestamptz;

-- 인덱스: 5분 이내 갱신 사용자 필터링 성능 향상
create index if not exists profiles_last_seen_idx
  on profiles (last_seen_at desc)
  where last_seen_at is not null;
