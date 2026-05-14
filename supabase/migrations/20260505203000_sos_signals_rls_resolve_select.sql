-- SOS 해제(update status -> resolved) 시
-- "new row violates row-level security policy for table sos_signals" 방지
--
-- 원인: SELECT 정책이 active·미만료 행만 허용하면, UPDATE 후 행이 SELECT에 막혀
--       일부 환경(PostgREST/RLS)에서 갱신이 거절될 수 있음.
-- 조치: 발신자·응답자는 해당 행을 상태와 무관하게 조회 허용 + UPDATE WITH CHECK 명시

-- 본인이 보낸 신호(해제·만료 포함)
create policy "sos_select_own_rows"
  on public.sos_signals for select
  using (auth.uid() is not null and auth.uid() = user_id);

-- 응답자로 연결된 신호(상태 무관 — 후속 UI·동기화용)
create policy "sos_select_responder_rows"
  on public.sos_signals for select
  using (auth.uid() is not null and auth.uid() = responder_id);

drop policy if exists "sos_update_own_or_responder" on public.sos_signals;

create policy "sos_update_own_or_responder"
  on public.sos_signals for update
  using (
    auth.uid() = user_id
    or auth.uid() = responder_id
  )
  with check (
    auth.uid() = user_id
    or auth.uid() = responder_id
  );
