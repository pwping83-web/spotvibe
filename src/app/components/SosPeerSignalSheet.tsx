/**
 * 지도에서 다른 이용자의 SOS 마커를 탭했을 때 — 유형·메모 확인 후 응답 여부 결정
 */
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Loader2, HandHeart, Maximize2, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabaseClient';
import {
  SOS_EXPIRE_MINUTES,
  getSosTypeMeta,
  sosMinutesLeft,
  type SosSignal,
} from '@/types/sos';

const ABUSE_CATEGORIES = [
  { id: 'promo_spam' as const, label: '가게 홍보·스팸' },
  { id: 'sexual' as const, label: '음란·성적 유도' },
  { id: 'crime_related' as const, label: '범죄·불법 유도' },
  { id: 'fake_emergency' as const, label: '가짜 긴급·장난' },
  { id: 'other' as const, label: '기타' },
];

interface SosPeerSignalSheetProps {
  open: boolean;
  signal: SosSignal | null;
  myUserId: string | null;
  onClose: () => void;
  onRespond: (signalId: string) => Promise<{ error?: string } | void>;
}

export function SosPeerSignalSheet({
  open,
  signal,
  myUserId,
  onClose,
  onRespond,
}: SosPeerSignalSheetProps) {
  const [busy, setBusy] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<(typeof ABUSE_CATEGORIES)[number]['id']>('fake_emergency');
  const [reportDetail, setReportDetail] = useState('');
  const [reportBusy, setReportBusy] = useState(false);

  const meta = signal ? getSosTypeMeta(signal.signal_type) : null;
  const minutesLeft = signal ? sosMinutesLeft(signal.expires_at) : 0;
  const isMine = !!(signal && myUserId && signal.user_id === myUserId);
  const iResponded = !!(signal && myUserId && signal.responder_id === myUserId);
  const otherResponder =
    signal?.responder_id && signal.responder_id !== myUserId;

  React.useEffect(() => {
    if (!open) {
      setPhotoExpanded(false);
      setReportOpen(false);
      setReportDetail('');
    }
  }, [open]);

  const submitAbuseReport = async () => {
    if (!signal || !myUserId || reportBusy) return;
    setReportBusy(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { data, error } = await sb.rpc('submit_sos_abuse_report', {
        p_signal_id: signal.id,
        p_category: reportCategory,
        p_detail: reportDetail.trim() || null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      const d = data as { ok?: boolean; error?: string };
      if (!d?.ok) {
        if (d?.error === 'cannot_report_own') toast.error('본인 신호는 신고할 수 없어요.');
        else toast.error('신고 처리에 실패했어요.');
        return;
      }
      toast.success('관리자에게 전달되었어요. 허위·홍보 신호는 검토 후 조치됩니다.');
      setReportOpen(false);
      setReportDetail('');
    } finally {
      setReportBusy(false);
    }
  };

  const handleRespond = async () => {
    if (!signal || !myUserId || busy) return;
    if (signal.responder_id && signal.responder_id !== myUserId) {
      toast.message('이미 다른 분이 응답 중이에요.');
      return;
    }
    setBusy(true);
    try {
      const r = await onRespond(signal.id);
      if (r && typeof r === 'object' && 'error' in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success('응답이 등록됐어요.');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && signal && (
        <>
          <motion.div
            className="pointer-events-auto fixed inset-0 z-[502] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="pointer-events-auto fixed bottom-0 left-1/2 z-[503] flex w-full max-w-[430px] -translate-x-1/2 flex-col overflow-hidden rounded-t-3xl border-t border-white/[0.1] bg-[#0F0F14] pb-[max(1.5rem,env(safe-area-inset-bottom))] max-h-[88dvh]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{meta?.icon ?? '🆘'}</span>
                <div>
                  <p className="text-[15px] font-bold text-white">주변 SOS 신호</p>
                  <p className="text-[10px] text-white/40">
                    유형을 확인한 뒤 도움 가능 여부를 결정해 주세요
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/50 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-2">
              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: meta?.border ?? 'rgba(255,255,255,0.2)',
                  background: meta?.bg ?? 'rgba(255,255,255,0.06)',
                }}
              >
                <p className="text-[14px] font-bold text-white">{meta?.label ?? '도움 요청'}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/70">
                  {meta?.sublabel ?? signal.signal_type}
                </p>
                <p className="mt-2 text-[11px] text-white/45">
                  남은 시간 약 <span className="font-semibold text-white/70">{minutesLeft}분</span>
                  {' · '}
                  최대 {SOS_EXPIRE_MINUTES}분 후 만료
                </p>
              </div>

              {signal.photo_url ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">현장 사진</p>
                  <button
                    type="button"
                    onClick={() => setPhotoExpanded(true)}
                    className="relative mt-2 w-full overflow-hidden rounded-xl border border-white/10 text-left outline-none ring-offset-2 ring-offset-[#0F0F14] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/60"
                  >
                    <img
                      src={signal.photo_url}
                      alt="SOS 첨부 사진"
                      className="max-h-48 w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-semibold text-white/90">
                      <Maximize2 size={12} />
                      크게 보기
                    </span>
                  </button>
                  {signal.ai_photo_summary ? (
                    <p className="mt-2 text-[12px] leading-snug text-cyan-200/85">
                      <span className="font-semibold text-cyan-300/90">AI 요약 · </span>
                      {signal.ai_photo_summary}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {signal.note ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">상황 메모</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/85">{signal.note}</p>
                </div>
              ) : null}

              <p className="text-center text-[10.5px] leading-relaxed text-white/38">
                이웃 간 도움 안내입니다. 공식 응급기관을 대체하지 않습니다.
              </p>

              {!isMine && myUserId ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
                  {!reportOpen ? (
                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/15 py-2.5 text-[13px] font-bold text-amber-100/95 active:scale-[0.99]"
                    >
                      <Flag size={17} strokeWidth={2.2} />
                      가짜·홍보·음란 등 신고 (관리자 검토)
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-semibold text-amber-100/90">신고 유형</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ABUSE_CATEGORIES.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setReportCategory(c.id)}
                            className={`rounded-lg border px-2 py-2 text-left text-[11px] font-semibold ${
                              reportCategory === c.id
                                ? 'border-amber-400/55 bg-amber-500/25 text-white'
                                : 'border-white/10 bg-white/[0.04] text-white/65'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        placeholder="추가 설명 (선택)"
                        value={reportDetail}
                        onChange={(e) => setReportDetail(e.target.value)}
                        maxLength={300}
                        rows={2}
                        className="w-full resize-none rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-[12px] text-white placeholder-white/30 outline-none focus:border-amber-400/35"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setReportOpen(false)}
                          className="flex-1 rounded-xl border border-white/15 py-2.5 text-[12px] font-semibold text-white/55"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          disabled={reportBusy}
                          onClick={() => void submitAbuseReport()}
                          className="flex flex-[1.3] items-center justify-center gap-1 rounded-xl bg-amber-600/90 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
                        >
                          {reportBusy ? <Loader2 className="animate-spin" size={16} /> : null}
                          관리자에게 송출
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {isMine ? (
                <p className="text-center text-[12px] text-white/45">
                  내가 보낸 신호예요. 상단 SOS 버튼에서 해제할 수 있어요.
                </p>
              ) : otherResponder ? (
                <p className="text-center text-[12px] text-violet-300/90">
                  다른 이용자가 먼저 응답한 신호예요. 필요하면 현장만 확인해 주세요.
                </p>
              ) : iResponded ? (
                <p className="text-center text-[12px] text-green-300/90">
                  이미 이 신호에 응답했어요. 안전에 유의해 주세요.
                </p>
              ) : !myUserId ? (
                <p className="text-center text-[12px] text-white/45">로그인 후 응답을 등록할 수 있어요.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleRespond}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold text-white transition-opacity disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${meta?.color ?? '#666'}aa 0%, ${meta?.color ?? '#888'} 100%)`,
                  }}
                >
                  {busy ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <HandHeart size={20} strokeWidth={2.2} />
                      가능하면 도와줄게요
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>

          <AnimatePresence>
            {photoExpanded && signal.photo_url ? (
              <motion.div
                key="sos-photo-lightbox"
                className="pointer-events-auto fixed inset-0 z-[510] flex flex-col items-center justify-center bg-black/88 p-4 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPhotoExpanded(false)}
              >
              <button
                type="button"
                onClick={() => setPhotoExpanded(false)}
                className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80"
                aria-label="닫기"
              >
                <X size={22} />
              </button>
              <img
                src={signal.photo_url}
                alt="SOS 첨부 사진 확대"
                className="max-h-[min(85dvh,100%)] max-w-full rounded-xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              {signal.ai_photo_summary ? (
                <p className="mt-4 max-w-md text-center text-[13px] leading-relaxed text-white/75">
                  {signal.ai_photo_summary}
                </p>
              ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
