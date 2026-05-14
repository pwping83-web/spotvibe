-- 이미 20260505200000_sos_signals 가 적용된 DB: 신규 insert 만료 기본값만 15분으로 조정
alter table public.sos_signals
  alter column expires_at set default (now() + interval '15 minutes');
