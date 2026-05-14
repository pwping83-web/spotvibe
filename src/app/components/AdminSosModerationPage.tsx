/**
 * 관리자 전용 — SOS / 현장제보·실시간 신고 처리 · 이용 제한 (pwping83@gmail.com RLS)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert, ShieldOff, Ban, CheckCircle, XCircle, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabaseClient';
import { getSosTypeMeta } from '@/types/sos';

type AbuseReportRow = {
  id: string;
  signal_id: string;
  reporter_id: string;
  category: string;
  detail: string | null;
  created_at: string;
  sos_signals: {
    id: string;
    signal_type: string;
    note: string | null;
    lat: number;
    lng: number;
    user_id: string;
    created_at: string;
  } | null;
};

type ModerationRow = {
  user_id: string;
  status: string;
  reason: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  admin_note: string | null;
};

type HeldSpotRow = {
  id: string;
  user_id: string | null;
  place_name: string | null;
  description: string | null;
  photo_url: string;
  ai_reason: string | null;
  created_at: string;
};

type ContentAbuseRow = {
  id: string;
  content_type: string;
  content_id: string;
  target_user_id: string;
  reporter_id: string;
  category: string;
  detail: string | null;
  created_at: string;
};

type SyncLogRow = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  fetched_count: number;
  inserted_count: number;
  skipped_count: number;
  error_msg: string | null;
  status: 'running' | 'ok' | 'error';
};

export function AdminSosModerationPage() {
  const [area, setArea] = useState<'sos' | 'spot' | 'sync'>('sos');
  const [tab, setTab] = useState<'reports' | 'moderation'>('reports');
  const [spotSub, setSpotSub] = useState<'held' | 'abuse'>('held');

  // ── 데이터 수집 패널 상태 ──
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>([]);
  const [syncBusy, setSyncBusy] = useState<string | null>(null);
  const [reports, setReports] = useState<AbuseReportRow[]>([]);
  const [moderations, setModerations] = useState<ModerationRow[]>([]);
  const [heldSpots, setHeldSpots] = useState<HeldSpotRow[]>([]);
  const [contentAbuse, setContentAbuse] = useState<ContentAbuseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    try {
      const [repRes, modRes, heldRes, contentRes, syncLogRes] = await Promise.all([
        sb
          .from('sos_signal_abuse_reports')
          .select(
            `
            id,
            signal_id,
            reporter_id,
            category,
            detail,
            created_at,
            sos_signals (
              id,
              signal_type,
              note,
              lat,
              lng,
              user_id,
              created_at
            )
          `,
          )
          .order('created_at', { ascending: false })
          .limit(80),
        sb
          .from('user_moderation')
          .select('user_id,status,reason,source,created_at,updated_at,admin_note')
          .order('updated_at', { ascending: false })
          .limit(80),
        sb
          .from('spot_reports')
          .select('id,user_id,place_name,description,photo_url,ai_reason,created_at')
          .eq('status', 'held')
          .order('created_at', { ascending: false })
          .limit(50),
        sb
          .from('content_abuse_reports')
          .select('id,content_type,content_id,target_user_id,reporter_id,category,detail,created_at')
          .order('created_at', { ascending: false })
          .limit(80),
        sb
          .from('public_notices_sync_log')
          .select('id,source,started_at,finished_at,fetched_count,inserted_count,skipped_count,error_msg,status')
          .order('started_at', { ascending: false })
          .limit(30),
      ]);

      if (repRes.error) {
        console.error(repRes.error);
        toast.error('SOS 신고 목록 오류', { description: repRes.error.message });
      } else {
        setReports((repRes.data ?? []) as AbuseReportRow[]);
      }
      if (modRes.error) {
        console.error(modRes.error);
        toast.error('제한 목록 오류', { description: modRes.error.message });
      } else {
        setModerations((modRes.data ?? []) as ModerationRow[]);
      }
      if (heldRes.error) {
        console.error(heldRes.error);
        toast.error('보류 제보 목록 오류', { description: heldRes.error.message });
      } else {
        setHeldSpots((heldRes.data ?? []) as HeldSpotRow[]);
      }
      if (contentRes.error) {
        console.error(contentRes.error);
        toast.error('유형별 신고 목록 오류', { description: contentRes.error.message });
      } else {
        setContentAbuse((contentRes.data ?? []) as ContentAbuseRow[]);
      }
      if (!syncLogRes?.error) {
        setSyncLogs((syncLogRes?.data ?? []) as SyncLogRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAdmin = async (
    label: string,
    fn: (sb: NonNullable<ReturnType<typeof getSupabase>>) => Promise<{ data: unknown; error: { message: string } | null }>,
  ) => {
    const sb = getSupabase();
    if (!sb) return;
    setBusyId(label);
    try {
      const { error, data } = await fn(sb);
      const ok = (data as { ok?: boolean } | null)?.ok === true;
      if (error || !ok) {
        toast.error('처리 실패', { description: error?.message ?? '권한 또는 응답 오류' });
        return;
      }
      toast.success('반영했어요.');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const triggerSync = async (source: 'all' | 'disaster_sms' | 'rss') => {
    const sb = getSupabase();
    if (!sb) return;
    setSyncBusy(source);
    try {
      const { data, error } = await sb.functions.invoke('sync-public-notices', {
        body: { source },
      });
      if (error) {
        toast.error('수집 실패', { description: error.message });
        return;
      }
      const res = data as { ok?: boolean; summary?: string } | null;
      if (res?.ok) {
        toast.success('수집 완료', { description: res.summary ?? '' });
      } else {
        toast.error('수집 오류', { description: '응답을 확인해 주세요.' });
      }
      await load();
    } finally {
      setSyncBusy(null);
    }
  };

  const categoryLabel = (c: string) =>
    ({
      promo_spam: '가게홍보·스팸',
      sexual: '음란·성적 유도',
      crime_related: '범죄·불법',
      fake_emergency: '가짜 긴급',
      other: '기타',
    })[c] ?? c;

  const emptyAll =
    loading &&
    reports.length === 0 &&
    moderations.length === 0 &&
    heldSpots.length === 0 &&
    contentAbuse.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0A0A0E]">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 py-3">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/70"
          aria-label="돌아가기"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-bold text-white">모더레이션</h1>
          <p className="text-[11px] text-white/45">SOS · 현장 제보(AI 보류) · 신고 누적(5인) 제한 해제</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 disabled:opacity-50"
          aria-label="새로고침"
        >
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-3 py-2">
        <button
          type="button"
          onClick={() => setArea('sos')}
          className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${
            area === 'sos' ? 'bg-[#00F0FF]/15 text-[#00F0FF]' : 'text-white/45'
          }`}
        >
          SOS
        </button>
        <button
          type="button"
          onClick={() => setArea('spot')}
          className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${
            area === 'spot' ? 'bg-violet-500/20 text-violet-200' : 'text-white/45'
          }`}
        >
          현장 제보·실시간
        </button>
        <button
          type="button"
          onClick={() => setArea('sync')}
          className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${
            area === 'sync' ? 'bg-yellow-500/20 text-yellow-200' : 'text-white/45'
          }`}
        >
          데이터 수집
        </button>
      </div>

      {area === 'sync' ? null : area === 'sos' ? (
        <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-3 py-2">
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${
              tab === 'reports' ? 'bg-[#00F0FF]/15 text-[#00F0FF]' : 'text-white/45'
            }`}
          >
            신고 큐
          </button>
          <button
            type="button"
            onClick={() => setTab('moderation')}
            className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${
              tab === 'moderation' ? 'bg-amber-500/15 text-amber-200' : 'text-white/45'
            }`}
          >
            이용 제한
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-3 py-2">
          <button
            type="button"
            onClick={() => setSpotSub('held')}
            className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${
              spotSub === 'held' ? 'bg-violet-500/20 text-violet-200' : 'text-white/45'
            }`}
          >
            AI 보류 ({heldSpots.length})
          </button>
          <button
            type="button"
            onClick={() => setSpotSub('abuse')}
            className={`rounded-xl px-3 py-2 text-[13px] font-semibold ${
              spotSub === 'abuse' ? 'bg-red-500/15 text-red-200/95' : 'text-white/45'
            }`}
          >
            유형별 신고 ({contentAbuse.length})
          </button>
        </div>
      )}

      {area !== 'sync' && <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-24 [scrollbar-width:thin]">
        {emptyAll ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-white/45">
            <Loader2 className="animate-spin" size={28} />
            <p className="text-[13px]">불러오는 중…</p>
          </div>
        ) : area === 'sos' && tab === 'reports' ? (
          <ul className="flex flex-col gap-3">
            {reports.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/40">접수된 SOS 신고가 없어요.</p>
            ) : (
              reports.map((r) => {
                const sig = r.sos_signals;
                const meta = sig ? getSosTypeMeta(sig.signal_type) : null;
                return (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45">
                      <span className="rounded-md bg-red-500/20 px-2 py-0.5 font-semibold text-red-200/95">
                        {categoryLabel(r.category)}
                      </span>
                      <span>{new Date(r.created_at).toLocaleString('ko-KR')}</span>
                    </div>
                    {sig ? (
                      <p className="mt-2 text-[14px] font-bold text-white">
                        {meta?.icon} {meta?.label ?? sig.signal_type}
                      </p>
                    ) : (
                      <p className="mt-2 text-[13px] text-amber-200/80">연결된 SOS 신호를 찾지 못했어요.</p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-white/35">
                      신호 ID {r.signal_id.slice(0, 8)}… · 발신 user {sig?.user_id?.slice(0, 8) ?? '—'}…
                    </p>
                    {sig?.note ? (
                      <p className="mt-2 text-[12px] text-white/65">메모: {sig.note}</p>
                    ) : null}
                    {r.detail ? (
                      <p className="mt-2 text-[12px] text-white/55">신고 내용: {r.detail}</p>
                    ) : null}
                    {sig ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            runAdmin(`clear-${sig.user_id}`, (s) =>
                              s.rpc('admin_clear_user_moderation', { p_user_id: sig.user_id }),
                            )
                          }
                          className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-[12px] font-semibold text-white/85"
                        >
                          <ShieldOff size={14} />
                          발신자 제한 해제
                        </button>
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            runAdmin(`suspend-${sig.user_id}`, (s) =>
                              s.rpc('admin_suspend_user', {
                                p_user_id: sig.user_id,
                                p_note: 'SOS 신고 검토: 일시 제한',
                              }),
                            )
                          }
                          className="flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-100"
                        >
                          <ShieldAlert size={14} />
                          일시 제한
                        </button>
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() =>
                            runAdmin(`ban-${sig.user_id}`, (s) =>
                              s.rpc('admin_ban_user_full', {
                                p_user_id: sig.user_id,
                                p_reason: 'SOS 악용 · 신고 검토 후 영구 제재',
                              }),
                            )
                          }
                          className="flex items-center gap-1 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-[12px] font-semibold text-red-100"
                        >
                          <Ban size={14} />
                          영구 제재
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        ) : area === 'sos' ? (
          <ul className="flex flex-col gap-3">
            {moderations.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/40">이용 제한 계정이 없어요.</p>
            ) : (
              moderations.map((m) => (
                <li
                  key={m.user_id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5"
                >
                  <p className="font-mono text-[11px] text-white/45">user {m.user_id}</p>
                  <p className="mt-1 text-[13px] font-bold text-white">
                    상태: <span className="text-amber-200">{m.status}</span>
                  </p>
                  <p className="mt-1 text-[12px] text-white/55">{m.reason ?? '—'}</p>
                  <p className="mt-1 text-[11px] text-white/35">출처: {m.source ?? '—'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() =>
                        runAdmin(`clear-mod-${m.user_id}`, (s) =>
                          s.rpc('admin_clear_user_moderation', { p_user_id: m.user_id }),
                        )
                      }
                      className="flex items-center gap-1 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-100"
                    >
                      <ShieldOff size={14} />
                      제한 해제(오해)
                    </button>
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() =>
                        runAdmin(`ban-mod-${m.user_id}`, (s) =>
                          s.rpc('admin_ban_user_full', {
                            p_user_id: m.user_id,
                            p_reason: m.reason ?? '영구 제재',
                          }),
                        )
                      }
                      className="flex items-center gap-1 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-[12px] font-semibold text-red-100"
                    >
                      <Ban size={14} />
                      영구 제재 + 이메일 차단
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        ) : spotSub === 'held' ? (
          <ul className="flex flex-col gap-3">
            {heldSpots.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/40">AI 보류 중인 제보가 없어요.</p>
            ) : (
              heldSpots.map((h) => (
                <li
                  key={h.id}
                  className="rounded-2xl border border-violet-500/25 bg-white/[0.03] p-3.5"
                >
                  <div className="flex gap-3">
                    <img
                      src={h.photo_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-white">{h.place_name ?? '(제목 없음)'}</p>
                      {h.description ? (
                        <p className="mt-1 text-[12px] text-white/65">{h.description}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-violet-200/80">AI: {h.ai_reason ?? '보류'}</p>
                      <p className="mt-1 font-mono text-[10px] text-white/35">
                        {h.id.slice(0, 8)}… · user {h.user_id?.slice(0, 8) ?? '—'}…
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() =>
                        runAdmin(`held-v-${h.id}`, (s) =>
                          s.rpc('admin_resolve_held_spot_report', {
                            p_report_id: h.id,
                            p_action: 'verify',
                          }),
                        )
                      }
                      className="flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-[12px] font-semibold text-emerald-100"
                    >
                      <CheckCircle size={14} />
                      공개 승인(verified)
                    </button>
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() =>
                        runAdmin(`held-r-${h.id}`, (s) =>
                          s.rpc('admin_resolve_held_spot_report', {
                            p_report_id: h.id,
                            p_action: 'reject',
                          }),
                        )
                      }
                      className="flex items-center gap-1 rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-white/80"
                    >
                      <XCircle size={14} />
                      반려(rejected)
                    </button>
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() =>
                        runAdmin(`held-h-${h.id}`, (s) =>
                          s.rpc('admin_resolve_held_spot_report', {
                            p_report_id: h.id,
                            p_action: 'hidden',
                          }),
                        )
                      }
                      className="flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-100"
                    >
                      <EyeOff size={14} />
                      비공개(hidden)
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        ) : (
          <ul className="flex flex-col gap-3">
            {contentAbuse.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/40">유형별 신고가 없어요.</p>
            ) : (
              contentAbuse.map((c) => (
                <li
                  key={c.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45">
                    <span className="rounded-md bg-red-500/20 px-2 py-0.5 font-semibold text-red-200/95">
                      {categoryLabel(c.category)}
                    </span>
                    <span className="text-white/35">{c.content_type}</span>
                    <span>{new Date(c.created_at).toLocaleString('ko-KR')}</span>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-white/35">
                    콘텐츠 {c.content_id.slice(0, 8)}… · 대상 user {c.target_user_id.slice(0, 8)}…
                  </p>
                  {c.detail ? (
                    <p className="mt-2 text-[12px] text-white/55">신고: {c.detail}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() =>
                        runAdmin(`ca-clear-${c.target_user_id}`, (s) =>
                          s.rpc('admin_clear_user_moderation', { p_user_id: c.target_user_id }),
                        )
                      }
                      className="flex items-center gap-1 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-100"
                    >
                      <ShieldOff size={14} />
                      대상 제한 해제
                    </button>
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() =>
                        runAdmin(`ca-ban-${c.target_user_id}`, (s) =>
                          s.rpc('admin_ban_user_full', {
                            p_user_id: c.target_user_id,
                            p_reason: '현장 제보·실시간 신고 검토 후 영구 제재',
                          }),
                        )
                      }
                      className="flex items-center gap-1 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-[12px] font-semibold text-red-100"
                    >
                      <Ban size={14} />
                      대상 영구 제재
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>}

      {/* ── 데이터 수집 패널 ── */}
      {area === 'sync' && (
        <div className="flex-1 overflow-y-auto px-4 pb-[5.5rem] pt-4" style={{ scrollbarWidth: 'none' }}>
          <p className="mb-4 text-[12px] leading-relaxed text-white/40">
            공공데이터포털·행안부 API에서 재난문자·지역행사를 수집합니다.
            <br />
            API 키가 설정된 경우에만 실제 수집이 이뤄집니다.
          </p>

          {/* 수동 트리거 버튼 */}
          <div className="mb-6 flex flex-wrap gap-2">
            {(
              [
                { key: 'all', label: '전체 수집', color: 'yellow' },
                { key: 'disaster_sms', label: '재난문자만', color: 'orange' },
                { key: 'rss', label: '지역행사만', color: 'violet' },
              ] as const
            ).map(({ key, label, color }) => (
              <button
                key={key}
                type="button"
                disabled={!!syncBusy}
                onClick={() => void triggerSync(key)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                  color === 'yellow'
                    ? 'border-yellow-500/35 bg-yellow-500/10 text-yellow-200'
                    : color === 'orange'
                      ? 'border-orange-500/35 bg-orange-500/10 text-orange-200'
                      : 'border-violet-500/35 bg-violet-500/10 text-violet-200'
                }`}
              >
                {syncBusy === key ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                {label}
              </button>
            ))}
          </div>

          {/* 수집 이력 로그 */}
          <h3 className="mb-2 text-[12px] font-semibold text-white/50">최근 수집 이력</h3>
          {syncLogs.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-white/30">
              아직 수집 이력이 없어요.
              <br />
              위 버튼으로 첫 수집을 실행하세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {syncLogs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`rounded-md px-2 py-0.5 font-bold ${
                        log.status === 'ok'
                          ? 'bg-green-500/20 text-green-300'
                          : log.status === 'error'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                      }`}
                    >
                      {log.status === 'ok' ? '성공' : log.status === 'error' ? '오류' : '진행중'}
                    </span>
                    <span className="font-semibold text-white/70">{log.source}</span>
                    <span className="text-white/35">
                      {new Date(log.started_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-white/45">
                    <span>조회 {log.fetched_count}건</span>
                    <span className="text-green-400/70">신규 {log.inserted_count}건</span>
                    <span>중복 {log.skipped_count}건</span>
                  </div>
                  {log.error_msg && (
                    <p className="mt-1.5 text-[11px] text-red-300/80">{log.error_msg}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
