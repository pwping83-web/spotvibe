import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, ListChecks, ExternalLink, Navigation } from 'lucide-react';
import type { MobilityProfile } from './MyPage';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { naverMapSearchUrl, SPOT_MOOD_IMAGES } from '../constants/spotMoodImages';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mobilityProfile: MobilityProfile;
}

/** 행동 지시 카드 — 기획 문구 그대로 */
const ACTION_CARDS = [
  {
    id: 'move',
    tag: '이동 팁',
    emoji: '🛴',
    body: '차 막히는 시간입니다. 따릉이나 킥보드를 타세요. 현재 반경 100m 내에 킥보드 3대 대여 가능!',
    accent: '#FFDE00',
    border: 'rgba(255,222,0,0.35)',
  },
  {
    id: 'time',
    tag: '타임라인',
    emoji: '⏱️',
    body: '딱 밤 10시까지만 치고 빠지세요. 10시 이후엔 강바람이 춥고 인파 패턴이 급감합니다.',
    accent: '#00F0FF',
    border: 'rgba(0,240,255,0.35)',
  },
  {
    id: 'vibe',
    tag: '바이브 팁',
    emoji: '👟',
    body: '오늘 한강 나들이의 킥은 \'신발\'입니다. 잔디밭 특성상 신발이 가장 잘 보이니 제일 아끼는 스니커즈를 신으세요!',
    accent: '#FF6B6B',
    border: 'rgba(255,107,107,0.35)',
  },
] as const;

const DEST_QUERY = '마포 한강시민공원';

function routeGuidanceCopy(profile: MobilityProfile): { title: string; body: string } {
  switch (profile) {
    case 'pedestrian_ddareungi':
      return {
        title: '뚜벅이 · 대중교통 추천',
        body:
          '505번 버스를 타고 홍대입구역·연남 일대에 내린 뒤, 마포 한강시민공원 방향으로 도보 이동하면 돼요. (네이버 지도 길찾기에도 같은 구간이 잡혀 있어요.) 근처 따릉이 거치대에서 바로 이어 타도 좋아요.',
      };
    case 'car_owner':
      return {
        title: '자차 · 네이버 내비 연동',
        body:
          '지금 시간대는 연남·홍대 일대 정체가 있어요. 네이버 내비에서 회피·고속 우선을 켜고 진입하면, 공원 주차장까지 예상 15분 전후예요. (실제 ETA는 내비 기준)',
      };
    case 'kickboard_license':
      return {
        title: '킥보드 면허 · PM 우선',
        body:
          '짧은 구간은 킥보드로 이동하고, 한강 산책로는 안전하게 도보로 이어가세요. 반경 100m 내 PM 대기 대수는 지도에서 확인할 수 있어요. (네이버 지도에서도 PM 주변 검색 가능)',
      };
  }
}

function DirectiveMiniMap() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0E] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="relative aspect-[320/150] w-full min-h-[140px]">
        <svg viewBox="0 0 320 150" className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="directiveRouteLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFDE00" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#00F0FF" stopOpacity="1" />
              <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.8" />
            </linearGradient>
            <filter id="directiveRouteGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="1.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 54 104 Q 162 24 270 88"
            fill="none"
            stroke="url(#directiveRouteLine)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="8 6"
            filter="url(#directiveRouteGlow)"
            opacity={0.95}
          />
          <circle cx="54" cy="104" r="10" fill="#FFDE00" />
          <circle cx="54" cy="104" r="4" fill="#0A0A0E" opacity={0.35} />
          <circle cx="270" cy="88" r="12" fill="#00F0FF" />
          <circle cx="270" cy="88" r="4" fill="#0A0A0E" opacity={0.4} />
        </svg>

        <div className="pointer-events-none absolute left-2 top-2 max-w-[48%] rounded-xl border border-white/10 bg-black/60 px-2.5 py-1.5 backdrop-blur-md">
          <p className="text-[9px] font-bold uppercase tracking-wide text-white/45">출발</p>
          <p className="text-[12px] font-bold text-[#FFDE00]">내 위치</p>
        </div>
        <div className="pointer-events-none absolute right-2 top-2 max-w-[52%] text-right">
          <div className="ml-auto rounded-xl border border-[#00F0FF]/30 bg-black/60 px-2.5 py-1.5 backdrop-blur-md">
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/45">도착</p>
            <p className="text-[12px] font-bold leading-snug text-[#00F0FF]">마포 한강공원</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BottomSheet({ isOpen, onClose, mobilityProfile }: BottomSheetProps) {
  const route = routeGuidanceCopy(mobilityProfile);
  const mapUrl = naverMapSearchUrl(DEST_QUERY);

  const openNaverMap = () => {
    window.open(mapUrl, '_blank', 'noopener,noreferrer');
  };

  const mainCtaLabel =
    mobilityProfile === 'car_owner'
      ? '내비로 경로 열고 출발하기 🚀'
      : mobilityProfile === 'kickboard_license'
        ? '경로 및 킥보드 위치 확인하기 🚀'
        : '경로 및 따릉이 위치 확인하기 🚀';

  const handleMainCta = () => {
    openNaverMap();
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
            className="absolute inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="absolute bottom-0 left-0 z-50 max-h-[92vh] w-full overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#12121A] shadow-2xl"
          >
            <div className="max-h-[92vh] overflow-y-auto px-4 pb-8 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 text-white/50 hover:text-white"
                aria-label="닫기"
              >
                <X size={20} />
              </button>

              <header className="mb-3 flex items-start gap-3 pr-10">
                <div className="rounded-2xl bg-[#00F0FF]/12 p-2.5 ring-1 ring-[#00F0FF]/25">
                  <Sparkles size={20} className="text-[#00F0FF]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">행동 지시 AI</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/50">
                    <ListChecks size={14} className="shrink-0 text-white/35" />
                    지금 현장 분위기까지 보여드릴게요
                  </p>
                </div>
              </header>

              {/* 현장 무드 — 사람 많은 한강 느낌 */}
              <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 ring-1 ring-[#00F0FF]/15">
                <ImageWithFallback
                  src={SPOT_MOOD_IMAGES.mapoHangangPark}
                  alt="마포 한강공원 인근, 사람들이 모여 있는 풍경"
                  className="h-36 w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0E] via-transparent to-black/30" />
                <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2">
                  <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-[#FFDE00] backdrop-blur-sm">
                    🔥 지금 핫한 현장
                  </span>
                  <span className="text-[10px] text-white/50">사진은 무드 예시예요</span>
                </div>
              </div>

              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                미니맵 라우팅
              </p>
              <DirectiveMiniMap />

              {/* 이동 프로필별 경로 안내 + 네이버 연동 */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#1A1A24]/80 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Navigation size={16} className="text-[#00F0FF]" />
                  <p className="text-[12px] font-bold text-[#00F0FF]">{route.title}</p>
                </div>
                <p className="text-[13px] leading-relaxed text-white/75">{route.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openNaverMap}
                    className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl border border-[#03C75A]/50 bg-[#03C75A]/15 px-3 py-2.5 text-[12px] font-bold text-[#03C75A] transition-colors hover:bg-[#03C75A]/25"
                  >
                    <ExternalLink size={14} />
                    네이버 지도로 길찾기
                  </button>
                  {mobilityProfile === 'car_owner' && (
                    <button
                      type="button"
                      onClick={openNaverMap}
                      className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/45 bg-[#00F0FF]/10 px-3 py-2.5 text-[12px] font-bold text-[#00F0FF] hover:bg-[#00F0FF]/18"
                    >
                      <ExternalLink size={14} />
                      내비·주차 검색
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-white/35">
                  추후 nmap:// 딥링크와 출·도착 좌표를 붙이면 앱에서 바로 길찾기로 연결할 수 있어요.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                  오늘의 액션 카드
                </p>
                <span className="text-[10px] text-white/30">옆으로 스와이프 →</span>
              </div>
              <div className="mt-2 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-visible px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {ACTION_CARDS.map((card, idx) => (
                  <motion.article
                    key={card.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="w-[min(300px,calc(100vw-3.5rem))] max-w-[300px] shrink-0 snap-center rounded-2xl border bg-[#1A1A24]/95 p-4 shadow-lg backdrop-blur-md"
                    style={{ borderColor: card.border, boxShadow: `0 0 24px ${card.accent}14` }}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                        style={{
                          backgroundColor: `${card.accent}18`,
                          color: card.accent,
                        }}
                      >
                        {card.tag}
                      </span>
                      <span className="text-2xl leading-none" aria-hidden>
                        {card.emoji}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium leading-relaxed text-white/88">{card.body}</p>
                  </motion.article>
                ))}
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={handleMainCta}
                className="relative mt-6 w-full overflow-hidden rounded-2xl border-2 border-[#00F0FF]/70 bg-gradient-to-r from-[#00F0FF]/25 via-[#00F0FF]/12 to-[#FFDE00]/15 py-4 text-[15px] font-black text-white shadow-[0_0_32px_rgba(0,240,255,0.45),0_0_64px_rgba(0,240,255,0.15)] transition-shadow hover:shadow-[0_0_40px_rgba(0,240,255,0.55)]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">{mainCtaLabel}</span>
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#00F0FF]/10 to-transparent" />
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
