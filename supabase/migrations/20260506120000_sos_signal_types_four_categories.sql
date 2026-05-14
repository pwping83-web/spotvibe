-- SOS 신호 유형을 4개(화재·치안·조난·구급)로 통합
-- 기존 세분 값은 의미에 맞게 매핑 후 CHECK 갱신

alter table public.sos_signals drop constraint if exists sos_signals_type_check;

update public.sos_signals set signal_type = 'fire' where signal_type = 'fire_sighting';

update public.sos_signals set signal_type = 'public_safety'
  where signal_type in ('safety_woman', 'safety_conflict', 'safety_threat');

update public.sos_signals set signal_type = 'missing' where signal_type = 'tourist_help';

update public.sos_signals set signal_type = 'medical'
  where signal_type in ('medical_immobile', 'medical_diabetes', 'medical_transport');

alter table public.sos_signals
  add constraint sos_signals_type_check check (signal_type in (
    'fire',
    'public_safety',
    'missing',
    'medical'
  ));
