-- ============================================================
-- SOS 상호 도움 신호 테이블 (시민 커뮤니티 기능)
-- 이 기능은 공식 응급서비스(119/112)를 절대 대체하지 않습니다.
-- 위급 시 반드시 먼저 119(응급) / 112(경찰)에 신고하세요.
-- ============================================================

create table if not exists public.sos_signals (
  id              uuid          primary key default gen_random_uuid(),
  user_id         uuid          not null references auth.users(id) on delete cascade,
  signal_type     text          not null,
  lat             double precision not null,
  lng             double precision not null,
  status          text          not null default 'active',  -- active | resolved | expired
  note            text,
  responder_id    uuid          references auth.users(id),
  responded_at    timestamptz,
  -- 기본 15분 자동 만료 (위치·상황 신선도, 오탐 노출 최소화)
  expires_at      timestamptz   not null default (now() + interval '15 minutes'),
  created_at      timestamptz   not null default now(),

  constraint sos_signals_status_check   check (status in ('active', 'resolved', 'expired')),
  constraint sos_signals_type_check     check (signal_type in (
    'medical_immobile',  -- 움직이기 어려워요
    'medical_diabetes',  -- 당뇨·혈당 도움
    'medical_transport', -- 이송 도움 (구급차 대기 중 이웃 지원)
    'safety_woman',      -- 여성 안전 도움
    'safety_conflict',   -- 분쟁 중재 요청
    'safety_threat',     -- 위협·강도 위험
    'fire_sighting',     -- 화재·위험 목격
    'tourist_help'       -- 여행객 도움 요청
  ))
);

-- 인덱스
create index if not exists sos_signals_status_expires_idx on public.sos_signals (status, expires_at);
create index if not exists sos_signals_location_idx       on public.sos_signals (lat, lng);
create index if not exists sos_signals_user_idx           on public.sos_signals (user_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.sos_signals enable row level security;

-- 활성 신호는 모든 로그인 사용자가 볼 수 있음
create policy "sos_select_active"
  on public.sos_signals for select
  using (
    auth.uid() is not null
    and status = 'active'
    and expires_at > now()
  );

-- 본인만 발신
create policy "sos_insert_own"
  on public.sos_signals for insert
  with check (auth.uid() = user_id);

-- 본인 또는 수락자가 상태 변경
create policy "sos_update_own_or_responder"
  on public.sos_signals for update
  using (
    auth.uid() = user_id
    or auth.uid() = responder_id
  );

-- ============================================================
-- Realtime 구독 (profiles와 같은 publication)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'sos_signals'
  ) then
    alter publication supabase_realtime add table public.sos_signals;
  end if;
end $$;
