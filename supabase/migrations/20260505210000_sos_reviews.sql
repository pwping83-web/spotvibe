-- SOS 지역 후기 + 좋아요 (타인 좋아요 20개 이상 시 베스트 승격 — 앱 상수와 동기)
-- region_key: 앱 `EXPLORE_REGION_PRESETS[].id` 와 동일 문자열

create table if not exists public.sos_reviews (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  region_key         text not null,
  body               text not null,
  lat                double precision,
  lng                double precision,
  like_count         integer not null default 0,
  promo_like_count   integer not null default 0,
  best_at            timestamptz,
  created_at         timestamptz not null default now(),

  constraint sos_reviews_body_len check (
    char_length(trim(body)) >= 10
    and char_length(body) <= 2000
  ),
  constraint sos_reviews_region_key_len check (
    char_length(region_key) >= 1
    and char_length(region_key) <= 64
  )
);

create index if not exists sos_reviews_region_created_idx
  on public.sos_reviews (region_key, created_at desc);

create index if not exists sos_reviews_region_best_idx
  on public.sos_reviews (region_key, best_at desc nulls last)
  where best_at is not null;

comment on table public.sos_reviews is '지역별 SOS·도움 후기. 베스트(best_at)는 타인 좋아요 20회 이상 시 1회 부여';
comment on column public.sos_reviews.promo_like_count is '작성자 제외 좋아요 수 — 베스트 승격 기준';
comment on column public.sos_reviews.best_at is '타인 좋아요가 임계값 이상이 된 시각(한 번 설정되면 유지)';

create table if not exists public.sos_review_likes (
  review_id uuid not null references public.sos_reviews (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists sos_review_likes_review_idx
  on public.sos_review_likes (review_id);

alter table public.sos_reviews enable row level security;
alter table public.sos_review_likes enable row level security;

-- 로그인 사용자는 후기 전체 읽기(지역 필터는 앱에서; 좋아요 유입용)
create policy "sos_reviews_select_authenticated"
  on public.sos_reviews for select
  to authenticated
  using (true);

create policy "sos_reviews_insert_own"
  on public.sos_reviews for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "sos_reviews_delete_own"
  on public.sos_reviews for delete
  to authenticated
  using (user_id = auth.uid());

create policy "sos_review_likes_select_authenticated"
  on public.sos_review_likes for select
  to authenticated
  using (true);

-- 본인 후기에는 좋아요 불가 (spot_report_likes 와 동일 패턴)
create policy "sos_review_likes_insert_not_author"
  on public.sos_review_likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.sos_reviews r
      where r.id = review_id
        and r.user_id is distinct from auth.uid()
    )
  );

create policy "sos_review_likes_delete_own"
  on public.sos_review_likes for delete
  to authenticated
  using (user_id = auth.uid());

-- 임계값 — 앱 `SOS_REVIEW_BEST_PROMO_LIKES` 와 맞출 것
create or replace function public.sos_review_likes_refresh_review_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  author_id uuid;
  total_c integer;
  promo_c integer;
  threshold integer := 20;
begin
  rid := coalesce(new.review_id, old.review_id);
  if rid is null then
    return null;
  end if;

  select r.user_id into author_id from public.sos_reviews r where r.id = rid;

  select count(*)::integer into total_c from public.sos_review_likes where review_id = rid;

  select count(*)::integer into promo_c
  from public.sos_review_likes l
  where l.review_id = rid
    and (author_id is null or l.user_id is distinct from author_id);

  update public.sos_reviews r
  set
    like_count = total_c,
    promo_like_count = promo_c,
    best_at = case
      when r.best_at is not null then r.best_at
      when promo_c >= threshold then now()
      else null
    end
  where r.id = rid;

  return null;
end;
$$;

drop trigger if exists trg_sos_review_likes_refresh on public.sos_review_likes;

create trigger trg_sos_review_likes_refresh
  after insert or delete on public.sos_review_likes
  for each row
  execute procedure public.sos_review_likes_refresh_review_meta();

update public.sos_reviews r
set
  like_count = coalesce((select count(*)::integer from public.sos_review_likes l where l.review_id = r.id), 0),
  promo_like_count = coalesce((
    select count(*)::integer
    from public.sos_review_likes l
    where l.review_id = r.id
      and l.user_id is distinct from r.user_id
  ), 0);

update public.sos_reviews r
set best_at = now()
where r.best_at is null
  and r.promo_like_count >= 20;
