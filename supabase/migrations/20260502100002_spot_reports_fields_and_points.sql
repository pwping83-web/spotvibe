-- spot_reports에 장소명·설명 컬럼 추가 (00000 마이그레이션보다 먼저 돌린 경우 등, 테이블이 있을 때만)
do $$
begin
  if to_regclass('public.spot_reports') is not null then
    alter table public.spot_reports add column if not exists place_name text;
    alter table public.spot_reports add column if not exists description text;
  end if;
end $$;

-- profiles에 누적 제보 포인트 컬럼 추가 (기본값 0)
alter table profiles
  add column if not exists contribution_points integer not null default 0;

-- Edge Function(service role)에서 atomic하게 포인트를 증가시키는 함수
create or replace function increment_contribution_points(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
as $$
begin
  update profiles
  set contribution_points = contribution_points + p_amount
  where id = p_user_id;
end;
$$;
