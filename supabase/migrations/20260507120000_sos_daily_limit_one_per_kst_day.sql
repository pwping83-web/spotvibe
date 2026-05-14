-- SOS 발신: 사용자당 한국 달력일 기준 1일 1회 (무분별 신호 방지)

create or replace function public.enforce_sos_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  day_start timestamptz;
  send_count integer;
begin
  day_start := ((current_timestamp at time zone 'Asia/Seoul')::date at time zone 'Asia/Seoul');

  select count(*)::integer into send_count
  from public.sos_signals
  where user_id = new.user_id
    and created_at >= day_start;

  if send_count >= 1 then
    raise exception 'sos_daily_limit'
      using errcode = '23514',
            hint = '한국 시간 기준 오늘 이미 SOS를 보냈습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists sos_signals_daily_limit_ins on public.sos_signals;

create trigger sos_signals_daily_limit_ins
  before insert on public.sos_signals
  for each row
  execute function public.enforce_sos_daily_limit();
