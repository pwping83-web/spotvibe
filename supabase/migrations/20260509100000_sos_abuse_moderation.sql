-- SOS 부정 이용(가짜·홍보·음란) 모더레이션 · 이용자 신고 · 재가입 제한 이메일

create table if not exists public.user_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in (
    'active',
    'suspended_ai',
    'suspended_admin',
    'banned'
  )),
  reason text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  admin_note text
);

create index if not exists user_moderation_status_idx on public.user_moderation (status);

drop trigger if exists trg_user_moderation_updated on public.user_moderation;
create trigger trg_user_moderation_updated
  before update on public.user_moderation
  for each row execute function public.update_updated_at();

create table if not exists public.sos_signal_abuse_reports (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.sos_signals(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('promo_spam', 'sexual', 'fake_emergency', 'other')),
  detail text,
  created_at timestamptz not null default now(),
  unique (signal_id, reporter_id)
);

create index if not exists sos_abuse_reports_signal_idx on public.sos_signal_abuse_reports (signal_id);
create index if not exists sos_abuse_reports_created_idx on public.sos_signal_abuse_reports (created_at desc);

comment on table public.sos_signal_abuse_reports is '타인 SOS 가짜·홍보 등 신고 — 관리자 검토 큐';

create table if not exists public.signup_email_bans (
  email_normalized text primary key,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

comment on table public.signup_email_bans is '재가입 차단 이메일(소문자 정규화)';

-- 관리자 판별: auth.users.email 과 일치 (카카오 등 OAuth 이메일)
create or replace function public.is_spotvibe_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(trim(coalesce(u.email, ''))) = 'pwping83@gmail.com'
  );
$$;

grant execute on function public.is_spotvibe_admin() to authenticated;

create or replace function public.check_my_email_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.signup_email_bans b
    inner join auth.users u on u.id = auth.uid()
    where b.email_normalized = lower(trim(coalesce(u.email, '')))
      and length(trim(coalesce(u.email, ''))) > 3
  );
$$;

grant execute on function public.check_my_email_banned() to authenticated;

alter table public.user_moderation enable row level security;

drop policy if exists "user_moderation_select_own" on public.user_moderation;
create policy "user_moderation_select_own"
  on public.user_moderation for select
  using (auth.uid() = user_id);

drop policy if exists "user_moderation_select_admin" on public.user_moderation;
create policy "user_moderation_select_admin"
  on public.user_moderation for select
  using ((select public.is_spotvibe_admin()));

alter table public.sos_signal_abuse_reports enable row level security;

drop policy if exists "sos_abuse_insert_reporter" on public.sos_signal_abuse_reports;
create policy "sos_abuse_insert_reporter"
  on public.sos_signal_abuse_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "sos_abuse_select_admin" on public.sos_signal_abuse_reports;
create policy "sos_abuse_select_admin"
  on public.sos_signal_abuse_reports for select
  using ((select public.is_spotvibe_admin()));

alter table public.signup_email_bans enable row level security;

drop policy if exists "signup_bans_admin_only" on public.signup_email_bans;
create policy "signup_bans_admin_only"
  on public.signup_email_bans for all
  using ((select public.is_spotvibe_admin()))
  with check ((select public.is_spotvibe_admin()));

-- ─── RPC: 이용자가 SOS 신고 ───
create or replace function public.submit_sos_abuse_report(
  p_signal_id uuid,
  p_category text,
  p_detail text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_rep uuid := auth.uid();
begin
  if v_rep is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select user_id into v_owner from public.sos_signals where id = p_signal_id limit 1;
  if v_owner is null then
    return json_build_object('ok', false, 'error', 'signal_not_found');
  end if;
  if v_owner = v_rep then
    return json_build_object('ok', false, 'error', 'cannot_report_own');
  end if;

  if p_category not in ('promo_spam', 'sexual', 'fake_emergency', 'other') then
    return json_build_object('ok', false, 'error', 'bad_category');
  end if;

  insert into public.sos_signal_abuse_reports (signal_id, reporter_id, category, detail)
  values (
    p_signal_id,
    v_rep,
    p_category,
    nullif(trim(coalesce(p_detail, '')), '')
  )
  on conflict (signal_id, reporter_id) do update
    set category = excluded.category,
        detail = excluded.detail,
        created_at = now();

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.submit_sos_abuse_report(uuid, text, text) to authenticated;

-- ─── RPC: 관리자 조치 ───
create or replace function public.admin_clear_user_moderation(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.is_spotvibe_admin()) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  delete from public.user_moderation where user_id = p_user_id;
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.admin_clear_user_moderation(uuid) to authenticated;

create or replace function public.admin_suspend_user(p_user_id uuid, p_note text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.is_spotvibe_admin()) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into public.user_moderation (user_id, status, reason, source, admin_note, reviewed_at, reviewed_by)
  values (
    p_user_id,
    'suspended_admin',
    coalesce(nullif(trim(p_note), ''), '관리자 조치: 이용 제한'),
    'admin',
    nullif(trim(coalesce(p_note, '')), ''),
    now(),
    auth.uid()
  )
  on conflict (user_id) do update set
    status = 'suspended_admin',
    reason = excluded.reason,
    admin_note = excluded.admin_note,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now();

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.admin_suspend_user(uuid, text) to authenticated;

create or replace function public.admin_ban_user_full(p_user_id uuid, p_reason text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not (select public.is_spotvibe_admin()) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select lower(trim(coalesce(email, ''))) into v_email from auth.users where id = p_user_id;
  if v_email is not null and length(v_email) > 3 then
    insert into public.signup_email_bans (email_normalized, reason, created_by)
    values (v_email, coalesce(nullif(trim(p_reason), ''), '관리자 영구 제재'), auth.uid())
    on conflict (email_normalized) do update set
      reason = excluded.reason,
      created_at = now(),
      created_by = auth.uid();
  end if;

  insert into public.user_moderation (user_id, status, reason, source, admin_note, reviewed_at, reviewed_by)
  values (
    p_user_id,
    'banned',
    coalesce(nullif(trim(p_reason), ''), '영구 제재'),
    'admin',
    nullif(trim(coalesce(p_reason, '')), ''),
    now(),
    auth.uid()
  )
  on conflict (user_id) do update set
    status = 'banned',
    reason = excluded.reason,
    admin_note = excluded.admin_note,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now();

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.admin_ban_user_full(uuid, text) to authenticated;

create or replace function public.admin_unban_email(p_email_normalized text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.is_spotvibe_admin()) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  delete from public.signup_email_bans where email_normalized = lower(trim(p_email_normalized));
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.admin_unban_email(text) to authenticated;
