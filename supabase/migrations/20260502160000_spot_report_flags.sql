-- 제보 신고: 사용자별 1회만 집계, 서로 다른 사용자 20명이면 status → hidden (피드 비노출)

alter table public.spot_reports drop constraint if exists spot_reports_status_check;

alter table public.spot_reports
  add constraint spot_reports_status_check
  check (status in ('pending', 'verified', 'rejected', 'hidden'));

create table if not exists public.spot_report_flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.spot_reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create index if not exists spot_report_flags_report_id_idx on public.spot_report_flags (report_id);

alter table public.spot_report_flags enable row level security;

create policy "read own flags"
  on public.spot_report_flags for select
  to authenticated
  using (user_id = auth.uid());

-- insert/update는 SECURITY DEFINER RPC만 사용

create or replace function public.flag_spot_report(p_report_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
  owner_id uuid;
  st text;
  ins_rows int;
  threshold int := 20;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select r.user_id, r.status into owner_id, st
  from public.spot_reports r
  where r.id = p_report_id;

  if owner_id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if st is distinct from 'verified' then
    return json_build_object('ok', false, 'error', 'not_flaggable');
  end if;

  if owner_id = uid then
    return json_build_object('ok', false, 'error', 'own_report');
  end if;

  insert into public.spot_report_flags (report_id, user_id)
  values (p_report_id, uid)
  on conflict (report_id, user_id) do nothing;

  get diagnostics ins_rows = row_count;

  select count(*)::int into n from public.spot_report_flags where report_id = p_report_id;

  if n >= threshold then
    update public.spot_reports
    set status = 'hidden'
    where id = p_report_id
      and status = 'verified';
  end if;

  return json_build_object(
    'ok', true,
    'count', n,
    'new_flag', ins_rows > 0,
    'auto_hidden', n >= threshold
  );
end;
$$;

revoke all on function public.flag_spot_report(uuid) from public;
grant execute on function public.flag_spot_report(uuid) to authenticated;
