-- 이벤트 탭「20대 / 30대 / 40대+」필터용: 제보 시점 프로필 연령을 스냅샷으로 둠
alter table public.spot_reports
  add column if not exists reporter_age_bucket text;

alter table public.spot_reports
  drop constraint if exists spot_reports_reporter_age_bucket_chk;

alter table public.spot_reports
  add constraint spot_reports_reporter_age_bucket_chk
  check (reporter_age_bucket is null or reporter_age_bucket in ('20s', '30s', '40s'));

comment on column public.spot_reports.reporter_age_bucket is
  '제보 INSERT 시점 profiles.age_range 기준. 10·20대→20s, 30대→30s, 40·50·60대+→40s. 이벤트 탭 필터에 사용.';

create index if not exists spot_reports_age_status_created_idx
  on public.spot_reports (reporter_age_bucket, status, created_at desc);

-- INSERT 시 제보자 프로필 연령으로 자동 설정(클라이언트 값 무시)
create or replace function public.spot_reports_set_reporter_age_bucket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ar text;
begin
  if new.user_id is null then
    new.reporter_age_bucket := null;
    return new;
  end if;

  select p.age_range into ar from public.profiles p where p.id = new.user_id;

  new.reporter_age_bucket := case
    when ar in ('10대', '20대') then '20s'
    when ar = '30대' then '30s'
    when ar in ('40대', '50대', '60대+') then '40s'
    else null
  end;

  return new;
end;
$$;

drop trigger if exists trg_spot_reports_reporter_age_bucket on public.spot_reports;

create trigger trg_spot_reports_reporter_age_bucket
  before insert on public.spot_reports
  for each row
  execute procedure public.spot_reports_set_reporter_age_bucket();

-- 기존 제보: 제보자 프로필 연령으로 백필(이미 값이 있으면 건너뜀)
update public.spot_reports sr
set reporter_age_bucket = case
  when p.age_range in ('10대', '20대') then '20s'
  when p.age_range = '30대' then '30s'
  when p.age_range in ('40대', '50대', '60대+') then '40s'
  else null
end
from public.profiles p
where sr.user_id = p.id
  and sr.reporter_age_bucket is null;
