import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import type { MobilityProfile } from './MyPage';
import { naverMapSearchUrl } from '../constants/spotMoodImages';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mobilityProfile: MobilityProfile;
  /** 지도「위치 변경」으로 찍은 도착지 — 있으면 네이버 검색에 사용 */
  destinationQuery?: string | null;
  destinationLabel?: string | null;
}

/** 더미 시나리오 — 기획 문구 그대로 */
const ACTION_CARDS = [
  {
    id: 'move',
    tag: '이동 팁',
    emoji: '🛴',
    body:
      '차 막히는 시간입니다. 현재 반경 100m 내에 대여 가능한 킥보드가 3대, 따릉이가 4대 있습니다. 킥보드를 타면 12분 컷!',
    accent: '#FDE68A',
    glow: 'rgba(253,230,138,0.35)',
  },
  {
    id: 'time',
    tag: '타임라인',
    emoji: '⏱️',
    body:
      '딱 밤 10시까지만 치고 빠지세요. 10시 이후엔 강바람이 춥고 인파 패턴이 급감하여 바이브가 식어버립니다.',
    accent: '#7DD3FC',
    glow: 'rgba(125,211,252,0.32)',
  },
  {
    id: 'style',
    tag: '스타일 팁',
    emoji: '👟',
    body:
      "오늘 한강 나들이의 킥은 '신발'입니다. 잔디밭 특성상 신발이 가장 잘 보이니 제일 아끼는 스니커즈를 신으세요!",
    accent: '#FCA5A5',
    glow: 'rgba(252,165,165,0.35)',
  },
] as const;

const DEST_QUERY = '마포 한강시민공원';

function DirectiveMiniMap({ destLabel }: { destLabel: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#16151A] shadow-inner">
      {/* 부드러운 앰비언트 — 그리드/패널 느낌 지양 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(120% 80% at 18% 88%, rgba(253,230,138,0.12), transparent 52%), radial-gradient(90% 70% at 88% 22%, rgba(125,211,252,0.1), transparent 50%), linear-gradient(165deg, #1c1a22 0%, #121118 100%)',
        }}
      />
      <div className="relative aspect-[320/158] w-full min-h-[148px]">
        <svg viewBox="0 0 320 158" className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="directiveRouteLine" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#7DD3FC" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FCA5A5" stopOpacity="0.75" />
            </linearGradient>
            <filter id="directiveRouteSoftGlow" x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 52 108 Q 128 36 210 52 Q 248 62 268 86"
            fill="none"
            stroke="url(#directiveRouteLine)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="7 7"
            filter="url(#directiveRouteSoftGlow)"
            opacity={0.92}
          />
          <circle cx="52" cy="108" r="11" fill="#FDE68A" opacity={0.95} />
          <circle cx="52" cy="108" r="4" fill="#1a181f" />
          <circle cx="268" cy="86" r="12" fill="#7DD3FC" opacity={0.95} />
          <circle cx="268" cy="86" r="4" fill="#1a181f" />
        </svg>

        <div className="pointer-events-none absolute left-2.5 top-2.5 max-w-[46%] rounded-2xl border border-white/[0.08] bg-black/45 px-3 py-2 backdrop-blur-md">
          <p className="text-[9px] font-semibold tracking-wide text-white/40">출발</p>
          <p className="text-[12.5px] font-bold text-[#FDE68A]/95">내 위치</p>
        </div>
        <div className="pointer-events-none absolute right-2.5 top-2.5 max-w-[54%] text-right">
          <div className="ml-auto rounded-2xl border border-white/[0.08] bg-black/45 px-3 py-2 backdrop-blur-md">
            <p className="text-[9px] font-semibold tracking-wide text-white/40">도착</p>
            <p className="text-left text-[12.5px] font-bold leading-snug text-[#7DD3FC]/95">{destLabel}</p>
          </div>
        </div>
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[9.5px] text-white/28">
          지도 연동 전 · UI 플레이스홀더
        </p>
      </div>
    </div>
  );
}

function mainCtaLabel(profile: MobilityProfile): string {
  switch (profile) {
    case 'car_owner':
      return '내비로 경로 열고 출발하기 🚀';
    case 'kickboard_license':
      return '경로 및 킥보드 위치 확인하고 출발 🚀';
    case 'pedestrian_ddareungi':
      return '경로 및 따릉이 위치 확인하고 출발 🚀';
  }
}

export function BottomSheet({
  isOpen,
  onClose,
  mobilityProfile,
  destinationQuery = null,
  destinationLabel = null,
}: BottomSheetProps) {
  const destQuery = destinationQuery?.trim() || DEST_QUERY;
  const destLabel = destinationLabel?.trim() || '마포 한강공원';
  const mapUrl = naverMapSearchUrl(destQuery);
  const mainCta = mainCtaLabel(mobilityProfile);

  const handleMainCta = () => {
    window.open(mapUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/50 backdrop-blur-[6px]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="absolute bottom-0 left-0 z-50 max-h-[90vh] w-full overflow-hidden rounded-t-[1.75rem] border border-white/[0.07] bg-[#141318]/98 shadow-[0_-24px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-xl"
          >
            <div className="max-h-[90vh] overflow-y-auto px-4 pb-8 pt-3.5 [scrollbar-width:thin]">
              <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-white/18" />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3.5 top-3.5 rounded-full p-2 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/80"
                aria-label="닫기"
              >
                <X size={20} strokeWidth={2} />
              </button>

              <header className="mb-4 flex items-start gap-3 pr-11">
                <div className="rounded-2xl bg-[#7DD3FC]/14 p-2.5 ring-1 ring-[#7DD3FC]/20 shadow-[0_8px_28px_-8px_rgba(125,211,252,0.35)]">
                  <Sparkles size={20} className="text-[#A5E9FF]" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold tracking-tight text-white/95">오늘은 이렇게 가면 돼</h2>
                  <p className="mt-1 text-[12px] leading-snug text-white/45">
                    동네 잘 아는 친구가 옆에서 속삭여 주는 느낌으로 정리했어요.
                  </p>
                </div>
              </header>

              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/32">미니맵 라우팅</p>
              <DirectiveMiniMap destLabel={destLabel} />

              <div className="mt-5 flex items-end justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/32">행동 지시 카드</p>
                <span className="pb-0.5 text-[10px] text-white/28">옆으로 넘겨 보기 →</span>
              </div>
              <div className="mt-2.5 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-visible px-1 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {ACTION_CARDS.map((card, idx) => (
                  <motion.article
                    key={card.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + idx * 0.07, type: 'spring', stiffness: 380, damping: 28 }}
                    className="w-[min(292px,calc(100vw-2.75rem))] max-w-[292px] shrink-0 snap-center rounded-2xl border border-white/[0.08] bg-[#1b1a21]/90 p-4 backdrop-blur-md"
                    style={{
                      boxShadow: `0 16px 40px -20px rgba(0,0,0,0.5), 0 0 48px -12px ${card.glow}`,
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide"
                        style={{
                          backgroundColor: `${card.accent}22`,
                          color: card.accent,
                        }}
                      >
                        {card.tag}
                      </span>
                      <span className="text-2xl leading-none" aria-hidden>
                        {card.emoji}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium leading-[1.55] text-white/[0.88]">{card.body}</p>
                  </motion.article>
                ))}
              </div>

              <div className="relative mt-2">
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-1 rounded-2xl opacity-80"
                  style={{
                    background: 'linear-gradient(115deg, rgba(94,234,212,0.22), rgba(125,211,252,0.2), rgba(253,230,138,0.14))',
                    filter: 'blur(18px)',
                  }}
                  animate={{ opacity: [0.55, 0.85, 0.55], scale: [0.99, 1.01, 0.99] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.988 }}
                  onClick={handleMainCta}
                  className="relative z-[1] w-full overflow-hidden rounded-2xl border border-teal-300/35 bg-gradient-to-r from-teal-400/25 via-cyan-400/22 to-sky-400/18 py-4 text-[14.5px] font-bold text-white/95 shadow-[0_12px_40px_-8px_rgba(45,212,191,0.42)] transition-shadow hover:shadow-[0_16px_48px_-6px_rgba(45,212,191,0.48)]"
                >
                  <span className="relative z-10 tracking-tight">{mainCta}</span>
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/[0.06] to-transparent" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
