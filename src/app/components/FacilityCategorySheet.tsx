/**
 * 동네 숨은 장소 카테고리 시트 — 꽃·자연 / 운동·체육
 * 네이버 지도에 없는 시민 제보 장소 · 실제 현장 사진 포함
 * 지도 FAB·마커: `/icons/facility-poi-fitness.svg` (차단 목록 회피용 중립 파일명)
 */
import React, { useState } from 'react';

export const OUTDOOR_GYM_MAP_ICON = '/icons/facility-poi-fitness.svg';
import { AnimatePresence, motion } from 'motion/react';
import { X, Clock, MapPin, Heart, ChevronLeft, ThumbsUp } from 'lucide-react';

interface FacilityCategorySheetProps {
  open: boolean;
  onClose: () => void;
  myLocation: { lat: number; lng: number } | null;
  /** 어떤 카테고리를 표시할지 — 탭 전환 없이 단독 표시 */
  defaultCategory?: 'nature' | 'gym';
}

type CatKey = 'nature' | 'gym';

interface Spot {
  id: string;
  cat: CatKey;
  emoji: string;
  label: string;
  desc: string;
  body: string;
  date: string;
  author: string;
  photo: string;
  likes: number;
  dist: string;
  tags: string[];
}

const DEMO_SPOTS: Spot[] = [
  {
    id: 'n1',
    cat: 'nature',
    emoji: '🌿',
    label: '식물 표본 구역',
    desc: '어린이 숲 체험원 내 · 봄철 신록 최고',
    body: '안양 숲길 안쪽으로 가다 보면 나오는 숨은 식물 구역이에요. 로프로 구역을 나눠놓고 각각 식물 이름표가 달려 있어요. 아이들이랑 오기 딱 좋은 곳이에요. 5월에 특히 녹음이 우거져서 예쁩니다 🌿',
    date: '2026-05-08',
    author: '안양주민',
    photo: '/demo/spot-plants.png',
    likes: 14,
    dist: '350m',
    tags: ['식물', '숲', '봄'],
  },
  {
    id: 'n2',
    cat: 'nature',
    emoji: '🦋',
    label: '어린이 숲 체험원',
    desc: '관-56 표지 근처 · 나비·곤충 관찰 포인트',
    body: '숲길 중간에 숨어있는 어린이 숲 체험원이에요. 네이버 지도엔 안 나와요. 봄에는 나비도 많고 풀냄새가 진해서 기분이 좋아지는 곳입니다. 이정표 관-56 표지를 찾으면 바로 옆에 있어요.',
    date: '2026-05-08',
    author: '등산러버',
    photo: '/demo/spot-trail-sign.png',
    likes: 22,
    dist: '480m',
    tags: ['어린이', '체험', '나비'],
  },
  {
    id: 'n3',
    cat: 'nature',
    emoji: '🍃',
    label: '조용한 산책로',
    desc: '산불 주의 현수막 구간 · 인적 드문 호젓한 길',
    body: '사람들이 잘 안 가는 조용한 구간이에요. 스마트 드론이 산불 감시 중이라는 현수막이 있는 코스인데, 오히려 사람이 적어서 산책하기 좋아요. 아침 일찍 오면 새소리만 들려요.',
    date: '2026-05-06',
    author: '새벽산책',
    photo: '/demo/spot-trail.png',
    likes: 8,
    dist: '620m',
    tags: ['산책', '조용함', '아침'],
  },
  {
    id: 'n4',
    cat: 'nature',
    emoji: '📚',
    label: '쉼터 도서관',
    desc: '숲 속 소형 도서관 · 한국 전통 지붕 형태',
    body: '숲길 한복판에 갑자기 나타나는 작은 도서관이에요! 처음 봤을 때 진짜 깜짝 놀랐어요. 책을 가져가고 두고 가는 무인 시스템이에요. 날씨 좋은 날엔 근처 벤치에 앉아 읽기 딱이에요 📖',
    date: '2026-05-08',
    author: '독서러',
    photo: '/demo/spot-library.png',
    likes: 31,
    dist: '290m',
    tags: ['도서관', '무인', '독서'],
  },
  {
    id: 'g1',
    cat: 'gym',
    emoji: '🏋️',
    label: '야외 헬스장',
    desc: '숲 속 무료 헬스장 · 벤치프레스·레그프레스 있음',
    body: '진짜 헬스장 기구가 숲 안에 있어요. 유리 벽면으로 되어있고 나무 사이에 있어서 운동하면서 숲 뷰가 보여요. 벤치프레스, 레그프레스, 케이블 머신도 있고요. 무료라는 게 신기합니다! 주말 오전엔 사람이 좀 있어요.',
    date: '2026-05-08',
    author: '헬스마니아',
    photo: '/demo/spot-gym.png',
    likes: 47,
    dist: '410m',
    tags: ['헬스', '무료', '숲뷰'],
  },
  {
    id: 'g2',
    cat: 'gym',
    emoji: '🏃',
    label: '야외 운동기구',
    desc: '숲길안내센터 앞 · 유산소·근력 기구 모두 있음',
    body: '숲길안내센터 바로 앞에 있는 야외 운동기구 구역이에요. 흰색 기구들이 정돈되어 있고 각 기구마다 사용법 안내판이 붙어 있어요. 가볍게 스트레칭하거나 유산소 기구 쓰기 좋아요. 무료에 개방 시간 제한도 없어요 🙌',
    date: '2026-05-08',
    author: '공원산책',
    photo: '/demo/spot-outdoor-gym.png',
    likes: 19,
    dist: '180m',
    tags: ['운동기구', '무료', '야외'],
  },
  {
    id: 'g3',
    cat: 'gym',
    emoji: '🏸',
    label: '배드민턴장',
    desc: '아파트 단지 내 무료 · 야간 조명 있음',
    body: '아파트 단지 뒤쪽에 숨어있는 배드민턴장이에요. 네이버엔 안 나오는데 동네 사람들만 알고 가는 곳이에요. 야간 조명이 있어서 저녁에도 칠 수 있어요. 평일 저녁엔 항상 사람들이 있어서 같이 끼워 달라고 하면 되더라고요 😄',
    date: '2026-05-07',
    author: '배드민턴러',
    photo: '/demo/spot-outdoor-gym.png',
    likes: 33,
    dist: '650m',
    tags: ['배드민턴', '무료', '야간'],
  },
];

const CAT_META: Record<CatKey, { emoji: string; title: string; desc: string }> = {
  nature: { emoji: '🌸', title: '꽃·자연 명소', desc: '네이버 지도에 없는 숲·꽃길·자연 명소' },
  gym:    { emoji: '🏋️', title: '야외 운동시설', desc: '무료 야외 헬스장·운동기구·배드민턴장' },
};

function daysAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (diff === 0) return '오늘';
  if (diff < 7)  return `${diff}일 전`;
  if (diff < 30) return `${Math.floor(diff / 7)}주 전`;
  return `${Math.floor(diff / 30)}개월 전`;
}

export function FacilityCategorySheet({ open, onClose, defaultCategory = 'nature' }: FacilityCategorySheetProps) {
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const spots = DEMO_SPOTS.filter((s) => s.cat === defaultCategory);
  const meta = CAT_META[defaultCategory];

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="fc-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/55 backdrop-blur-sm"
            onClick={() => { if (selectedSpot) setSelectedSpot(null); else onClose(); }}
          />

          {/* ─── 상세 뷰 ─── */}
          <AnimatePresence>
            {selectedSpot && (
              <motion.div
                key="detail"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                className="fixed bottom-0 left-0 right-0 z-[620] overflow-y-auto rounded-t-3xl"
                style={{
                  maxHeight: '88vh',
                  background: 'rgba(12,12,20,0.99)',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingBottom: 'calc(5.5rem + 0.5rem)',
                }}
              >
                {/* 사진 */}
                <div className="relative">
                  <img
                    src={selectedSpot.photo}
                    alt={selectedSpot.label}
                    className="w-full object-cover"
                    style={{ maxHeight: 260, objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {/* 뒤로 버튼 */}
                  <button
                    type="button"
                    onClick={() => setSelectedSpot(null)}
                    className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
                  >
                    <ChevronLeft size={18} className="text-white" />
                  </button>
                </div>

                <div className="px-5 pt-4">
                  {/* 태그 */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedSpot.tags.map((t) => (
                      <span key={t}
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                        #{t}
                      </span>
                    ))}
                  </div>

                  {/* 제목 */}
                  <p className="text-[19px] font-black text-white mb-1">
                    {selectedSpot.emoji} {selectedSpot.label}
                  </p>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[12px] text-white/40">{selectedSpot.author}</span>
                    <span className="text-[12px] text-white/30">{daysAgo(selectedSpot.date)}</span>
                    <span className="flex items-center gap-1 text-[12px] text-white/30">
                      <MapPin size={11} />{selectedSpot.dist}
                    </span>
                  </div>

                  {/* 본문 */}
                  <p className="text-[14.5px] leading-relaxed text-white/75 mb-5">
                    {selectedSpot.body}
                  </p>

                  {/* 좋아요 */}
                  <button
                    type="button"
                    onClick={() => toggleLike(selectedSpot.id)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all active:scale-95"
                    style={
                      likedIds.has(selectedSpot.id)
                        ? { background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.35)' }
                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    <Heart
                      size={16}
                      style={{ color: likedIds.has(selectedSpot.id) ? '#F472B6' : 'rgba(255,255,255,0.4)' }}
                      fill={likedIds.has(selectedSpot.id) ? '#F472B6' : 'none'}
                    />
                    <span
                      className="text-[13px] font-bold"
                      style={{ color: likedIds.has(selectedSpot.id) ? '#F472B6' : 'rgba(255,255,255,0.4)' }}
                    >
                      {selectedSpot.likes + (likedIds.has(selectedSpot.id) ? 1 : 0)}
                    </span>
                    <span className="text-[12px] text-white/30">
                      {likedIds.has(selectedSpot.id) ? '좋아요 취소' : '좋아요'}
                    </span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── 목록 시트 ─── */}
          <motion.div
            key="fc-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[601] overflow-y-auto rounded-t-3xl"
            style={{
              maxHeight: '85vh',
              background: 'rgba(12,12,20,0.98)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              paddingBottom: 'calc(5.5rem + 0.5rem)',
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <button
                type="button"
                onClick={onClose}
                className="pointer-events-auto h-3 w-14 flex items-center justify-center"
                aria-label="닫기"
              >
                <span className="block h-1 w-full rounded-full bg-white/20" />
              </button>
            </div>

            <div className="px-5 pt-3">
              {/* 헤더 */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[17px] font-black text-white">{meta.emoji} {meta.title}</p>
                  <p className="text-[12px] text-white/40 mt-0.5">{meta.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/40"
                >
                  <X size={15} />
                </button>
              </div>

              {/* 장소 카드 목록 */}
              <div className="flex flex-col gap-3">
                {spots.map((spot) => (
                  <motion.button
                    key={spot.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedSpot(spot)}
                    className="w-full rounded-2xl overflow-hidden text-left"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {/* 사진 썸네일 */}
                    <div className="relative w-full" style={{ height: 140 }}>
                      <img
                        src={spot.photo}
                        alt={spot.label}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const el = e.target as HTMLImageElement;
                          el.style.display = 'none';
                          const parent = el.parentElement;
                          if (parent) parent.style.background = 'rgba(255,255,255,0.06)';
                        }}
                      />
                      {/* 거리 뱃지 */}
                      <span
                        className="absolute bottom-2 right-2 rounded-full px-2 py-1 text-[10.5px] font-bold"
                        style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)' }}
                      >
                        <MapPin size={9} className="inline mr-0.5" />{spot.dist}
                      </span>
                    </div>

                    {/* 내용 */}
                    <div className="px-3.5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-[14px] font-bold text-white">
                            {spot.emoji} {spot.label}
                          </p>
                          <p className="text-[12px] text-white/50 mt-0.5 leading-snug line-clamp-2">
                            {spot.body.slice(0, 60)}…
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-[11px] text-white/28">{spot.author}</span>
                        <span className="flex items-center gap-1 text-[11px] text-white/25">
                          <Clock size={9} />{daysAgo(spot.date)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-white/25 ml-auto">
                          <ThumbsUp size={9} />{spot.likes}
                        </span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* 제보 안내 */}
              <div className="mt-4 rounded-xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[12px] font-semibold text-white/40 mb-1">이런 장소를 발견하면 제보해주세요</p>
                <p className="text-[11.5px] text-white/28 leading-relaxed">
                  GPS 켜고 현장 사진 촬영 → 현장 제보 버튼 → 카테고리 선택
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
