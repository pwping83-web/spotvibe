-- 이전 마이그레이션이 일부만 적용된 DB에서 RPC·앱이 깨지지 않도록 컬럼 보장
-- 오류: column "contribution_points" does not exist

alter table public.profiles
  add column if not exists contribution_points integer not null default 0;

alter table public.profiles
  add column if not exists peek_session_until timestamptz;

comment on column public.profiles.contribution_points is '현장 제보 등으로 적립된 포인트. 바이브 부스트 발동 시 소모.';
comment on column public.profiles.peek_session_until is '바이브 부스트 세션 만료 시각(UTC).';
