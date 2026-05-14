-- 시각장애인 이웃 도움 메시지: 근처 위험 등 짧은 문자 → 수신 동의 사용자에게 실시간 전달 + 앱에서 음성 안내
-- 스팸 방지: 동일 발신→수신 1시간당 최대 6건

alter table public.profiles
  add column if not exists vi_neighbor_tips_opt_in boolean not null default false;

comment on column public.profiles.vi_neighbor_tips_opt_in is
  'true: 다른 이용자가 보낸 이웃 도움 메시지를 수신·음성 안내(위치 explore_lat/lng 공개 시에만 근처에 노출)';

create table if not exists public.vi_neighbor_help_messages (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  sender_id     uuid references public.profiles(id) on delete set null,
  body          text not null,
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  sender_lat    double precision,
  sender_lng    double precision,
  constraint vi_help_body_len check (char_length(body) between 4 and 300)
);

create index if not exists vi_help_recipient_created_idx
  on public.vi_neighbor_help_messages (recipient_id, created_at desc);

create index if not exists vi_help_sender_created_idx
  on public.vi_neighbor_help_messages (sender_id, created_at desc);

-- 동일 발신→수신 1시간당 최대 6건
create or replace function public.vi_neighbor_help_rate_limit()
returns trigger
language plpgsql
as $$
declare
  c int;
begin
  if new.sender_id is null then
    raise exception 'sender_id required';
  end if;
  if new.sender_id = new.recipient_id then
    raise exception 'cannot send to self';
  end if;
  select count(*)::int into c
  from public.vi_neighbor_help_messages
  where sender_id = new.sender_id
    and recipient_id = new.recipient_id
    and created_at > now() - interval '1 hour';
  if c >= 6 then
    raise exception 'rate limit: too many messages to this recipient in 1 hour';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.recipient_id and p.vi_neighbor_tips_opt_in = true
  ) then
    raise exception 'recipient has not opted in to neighbor tips';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vi_neighbor_help_rate_limit on public.vi_neighbor_help_messages;
create trigger trg_vi_neighbor_help_rate_limit
  before insert on public.vi_neighbor_help_messages
  for each row execute function public.vi_neighbor_help_rate_limit();

alter table public.vi_neighbor_help_messages enable row level security;

drop policy if exists vi_help_select_own on public.vi_neighbor_help_messages;
create policy vi_help_select_own
  on public.vi_neighbor_help_messages for select
  to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());

drop policy if exists vi_help_insert_authenticated on public.vi_neighbor_help_messages;
create policy vi_help_insert_authenticated
  on public.vi_neighbor_help_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = recipient_id and p.vi_neighbor_tips_opt_in = true
    )
  );

drop policy if exists vi_help_recipient_update_read on public.vi_neighbor_help_messages;
create policy vi_help_recipient_update_read
  on public.vi_neighbor_help_messages for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Realtime: 수신자에게 INSERT 이벤트 전달
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vi_neighbor_help_messages'
  ) then
    alter publication supabase_realtime add table public.vi_neighbor_help_messages;
  end if;
end $$;
