-- 휴대폰 본인·성인 확인 완료 시각(서버 전용). 클라이언트 직접 수정 금지.
-- 본인확인 API(다날·KCP·PASS 등) 콜백은 Edge Function 등에서 service_role로만 갱신.

alter table public.profiles
  add column if not exists certified_at timestamptz,
  add column if not exists certification_vendor text;

comment on column public.profiles.certified_at is '휴대폰 본인확인 등 성인·본인 확인 완료 시각(UTC). 서버만 갱신.';
comment on column public.profiles.certification_vendor is '인증 모듈 식별자(예: danal, kcp, pass). 서버만 갱신.';

-- 인증 필드는 일반 JWT(authenticated)로는 INSERT/UPDATE 불가 — service_role만 변경 허용
create or replace function public.guard_profiles_certification_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.certified_at is not null or (new.certification_vendor is not null and btrim(new.certification_vendor) <> '') then
      raise exception 'certification fields are server-managed only';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.certified_at is distinct from old.certified_at
       or new.certification_vendor is distinct from old.certification_vendor then
      if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
        raise exception 'certification fields are server-managed only';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_cert on public.profiles;
create trigger trg_profiles_guard_cert
  before insert or update on public.profiles
  for each row
  execute function public.guard_profiles_certification_fields();

-- service_role 전용: 인증 성공 후 한 번 호출 (Edge Function에서 호출)
create or replace function public.mark_profile_certified(p_user_id uuid, p_vendor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.profiles
     set certified_at = now(),
         certification_vendor = nullif(btrim(p_vendor), '')
   where id = p_user_id;

  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mark_profile_certified(uuid, text) from public;
grant execute on function public.mark_profile_certified(uuid, text) to service_role;
