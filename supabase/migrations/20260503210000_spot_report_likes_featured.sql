-- 현장 제보 좋아요 + 타인 좋아요 20개 이상 시 이벤트 탭「핫 픽」노출용 타임스탬프
-- 본인 좋아요는 불가(RLS). 승격 집계는 제보 작성자 제외 좋아요만 센다.

alter table public.spot_reports
  add column if not exists like_count integer not null default 0;

alter table public.spot_reports
  add column if not exists featured_in_events_at timestamptz;

comment on column public.spot_reports.like_count is 'spot_report_likes 행 수(본인 포함 표시용)';
comment on column public.spot_reports.featured_in_events_at is '타인 좋아요가 임계값 이상이 된 시각(한 번 올라가면 유지)';

create table if not exists public.spot_report_likes (
  report_id uuid not null references public.spot_reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create index if not exists spot_report_likes_report_idx
  on public.spot_report_likes (report_id);

create index if not exists spot_reports_featured_idx
  on public.spot_reports (featured_in_events_at desc nulls last)
  where featured_in_events_at is not null;

alter table public.spot_report_likes enable row level security;

create policy "spot_report_likes_select_own_or_all"
  on public.spot_report_likes for select
  to authenticated
  using (true);

create policy "spot_report_likes_insert_own_not_owner"
  on public.spot_report_likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.spot_reports sr
      where sr.id = report_id
        and sr.status = 'verified'
        and (sr.user_id is null or sr.user_id <> auth.uid())
    )
  );

create policy "spot_report_likes_delete_own"
  on public.spot_report_likes for delete
  to authenticated
  using (user_id = auth.uid());

-- 임계값(타인 좋아요) — 앱 상수 SPOT_REPORT_FEATURE_PROMOTION_LIKES 와 맞출 것
create or replace function public.spot_report_likes_refresh_report_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  owner_id uuid;
  total_c integer;
  promo_c integer;
  threshold integer := 20;
begin
  rid := coalesce(new.report_id, old.report_id);
  if rid is null then
    return null;
  end if;

  select sr.user_id into owner_id from public.spot_reports sr where sr.id = rid;

  select count(*)::integer into total_c from public.spot_report_likes where report_id = rid;

  select count(*)::integer into promo_c
  from public.spot_report_likes l
  where l.report_id = rid
    and (owner_id is null or l.user_id is distinct from owner_id);

  update public.spot_reports sr
  set
    like_count = total_c,
    featured_in_events_at = case
      when sr.featured_in_events_at is not null then sr.featured_in_events_at
      when promo_c >= threshold then now()
      else null
    end
  where sr.id = rid;

  return null;
end;
$$;

drop trigger if exists trg_spot_report_likes_refresh on public.spot_report_likes;

create trigger trg_spot_report_likes_refresh
  after insert or delete on public.spot_report_likes
  for each row
  execute procedure public.spot_report_likes_refresh_report_meta();

-- 기존 행 like_count 동기화(좋아요 테이블 비어 있으면 0)
update public.spot_reports sr
set like_count = coalesce((
  select count(*)::integer from public.spot_report_likes l where l.report_id = sr.id
), 0);
