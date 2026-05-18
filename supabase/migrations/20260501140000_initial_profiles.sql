-- 스팟바이브 초기 스키마: 사용자 프로필 (auth.users 1:1)
-- Supabase SQL Editor에서 전체 실행하거나: supabase db push (CLI 연동 시)

-- ── 프로필 테이블 (앱 MyPage 필드와 대응)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  display_name text,
  avatar_url text,

  age_range text,
  gender text,

  mobility_profile text not null default 'pedestrian_ddareungi'
    check (mobility_profile in ('car_owner', 'kickboard_license', 'pedestrian_ddareungi')),

  mbti_types text[] not null default '{}',
  blood_types text[] not null default '{}',

  gender_crowd_pref text not null default 'all'
    check (gender_crowd_pref in ('all', 'female_crowd', 'male_crowd')),

  activity_tags text[] not null default '{}',

  -- 요일: 0=월 … 6=일 (MyPage WEEKDAYS 인덱스와 동일)
  notification_weekdays smallint[] not null default array[0, 2, 4]::smallint[],
  notification_time_slots text[] not null default array['evening']::text[],

  ai_notifications_paused boolean not null default false,

  location_mode text not null default 'my_location'
    check (location_mode in ('my_location', 'explore')),
  explore_lat double precision,
  explore_lng double precision,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '스팟바이브 사용자 설정·마이페이지 동기화';
comment on column public.profiles.notification_time_slots is 'lunch | afternoon | evening | late';

-- updated_at 자동 갱신
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_profiles_updated_at();

-- 회원가입 시 빈 프로필 행 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- 이미 가입돼 있던 계정용 (최초 1회 실행해도 무방)
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
