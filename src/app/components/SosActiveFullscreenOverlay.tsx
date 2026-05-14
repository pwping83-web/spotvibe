import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { SOS_EXPIRE_MINUTES } from '@/types/sos';

/**
 * 활성 SOS — 배경은 거의 투명에 가깝게 두어 지도·마커 확인이 우선. 카드만 얇은 글래스로 가독성 유지.
 * 닫기(신호 종료)만 제공 — 배경 탭으로는 닫히지 않음.
 */
export function SosActiveFullscreenOverlay({
  onEndSignal,
}: {
  onEndSignal: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleEnd = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onEndSignal();
    } catch {
      /* 실패 시 toast는 App(handleSosResolve)에서 처리 */
    } finally {
      setBusy(false);
    }
  };

  const iconPulseTransition =
    reduceMotion === true
      ? { duration: 0 }
      : { repeat: Infinity, duration: 1.15, ease: 'easeInOut' as const };

  const iconPulseAnimate =
    reduceMotion === true ? { scale: 1 } : { scale: [1, 1.06, 1] };

  return (
    <div
      className="fixed inset-0 z-[550] overflow-hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sos-fullscreen-title"
      aria-describedby="sos-fullscreen-desc"
    >
      {/* 아주 옅은 딤 + 장식 — 지도가 대부분 그대로 보이게 */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/14 via-black/[0.08] to-black/12"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 spotvibe-sos-fs-blob opacity-[0.14]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 spotvibe-sos-fs-blob-cyan opacity-[0.18]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 spotvibe-sos-fs-vignette opacity-[0.12]" aria-hidden />

      <div
        className="relative flex min-h-[100dvh] flex-col overflow-y-auto overscroll-y-contain px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))]"
      >
        <div className="mx-auto flex w-full max-w-[min(100%,24rem)] flex-1 flex-col items-center justify-center py-6">
          <motion.div
            initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full max-w-[min(100%,24rem)] flex-col items-center rounded-[1.75rem] border border-white/18 bg-black/22 px-5 py-8 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/10 backdrop-blur-[6px] sm:px-7"
          >
            <div className="spotvibe-sos-fs-icon-wrap mb-8">
              <span
                className="spotvibe-me-marker-pulse-ring spotvibe-sos-fs-pulse-ring"
                aria-hidden
              />
              <span
                className="spotvibe-me-marker-pulse-ring spotvibe-sos-fs-pulse-ring spotvibe-sos-fs-pulse-ring--delay"
                aria-hidden
              />
              <motion.div
                className="relative z-[2] flex h-[52px] w-[52px] items-center justify-center rounded-full border-4 border-red-500/55 bg-red-500/[0.22] shadow-[0_0_52px_rgba(239,68,68,0.52)]"
                animate={iconPulseAnimate}
                transition={iconPulseTransition}
              >
                <span className="select-none text-[2.25rem] leading-none" role="img" aria-hidden>
                  🆘
                </span>
              </motion.div>
            </div>

            <h1
              id="sos-fullscreen-title"
              className="mb-2 text-center text-[clamp(1.25rem,4.5vw,1.5rem)] font-black tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.85),0_0_24px_rgba(0,0,0,0.55)]"
            >
              SOS 신호 중
            </h1>
            <p
              id="sos-fullscreen-desc"
              className="mb-8 w-full max-w-[min(100%,22rem)] text-center text-[13px] leading-snug text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_18px_rgba(0,0,0,0.45)] sm:text-[14px]"
            >
              주변 이용자에게 알림이 전달 중입니다.
              <br />
              배경이 거의 비치니 지도에서 내 신호 마커가 실제 위치와 맞는지 바로 확인할 수 있어요.
              <br />
              앱을 백그라운드로 보내도 신호는 유지됩니다. 해결되면 아래에서 꼭 종료해 주세요.
              <br />
              <span className="text-white/40">최대 {SOS_EXPIRE_MINUTES}분 후 자동 만료</span>
            </p>

            <button
              type="button"
              onClick={handleEnd}
              disabled={busy}
              className={`flex w-full min-h-[48px] max-w-[min(100%,22rem)] items-center justify-center gap-2 rounded-2xl border border-red-500/50 bg-gradient-to-b from-red-600 to-red-700 px-4 py-3.5 text-[15px] font-black text-white transition-opacity active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 ${
                busy ? '' : 'spotvibe-sos-fs-cta-glow'
              }`}
            >
              {busy ? (
                <Loader2 size={22} className="animate-spin" aria-hidden />
              ) : (
                <X size={22} strokeWidth={2.6} aria-hidden />
              )}
              {busy ? '종료 중…' : '닫기 · 신호 종료'}
            </button>

            <p className="mt-6 max-w-[min(100%,20rem)] text-center text-[11px] leading-snug text-white/55 [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]">
              이 화면을 닫으면 주변에 보낸 신호가 즉시 해제됩니다.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
