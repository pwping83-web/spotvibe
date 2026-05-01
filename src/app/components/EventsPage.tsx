import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Flame, Users, Sparkles, TrendingUp, Star } from 'lucide-react';

type FilterKey = 'all' | '20s' | '30s' | '40s';

const FILTERS: { key: FilterKey; label: string; accent: string }[] = [
  { key: 'all',  label: '전체',   accent: '#ffffff' },
  { key: '20s',  label: '20대',   accent: '#FFDE00' },
  { key: '30s',  label: '30대',   accent: '#FF6B6B' },
  { key: '40s',  label: '40대+',  accent: '#00F0FF' },
];

const events = [
  { id: 1, title: '홍대 버스킹 페스티벌', category: '버스킹',    distance: '0.3km', accent: '#FFDE00', ageGroup: '20s', emoji: '🎸', crowd: '110명 활성', isHot: true,  isSponsored: false, trend: '+24%' },
  { id: 2, title: '연남동 플리마켓 타임세일', category: '플리마켓', distance: '0.8km', accent: '#FFDE00', ageGroup: '20s', emoji: '🛍️', crowd: '95명 집결',  isHot: false, isSponsored: true,  trend: '+12%' },
  { id: 3, title: '여의도 한강 무료 에어로빅', category: '피트니스', distance: '2.1km', accent: '#00F0FF', ageGroup: '40s', emoji: '🏃', crowd: '152명 운동 중', isHot: true,  isSponsored: false, trend: '+41%' },
  { id: 4, title: '성수동 브랜드 팝업 스토어', category: '팝업',    distance: '3.1km', accent: '#FFDE00', ageGroup: '20s', emoji: '🏪', crowd: '200명 방문',  isHot: true,  isSponsored: true,  trend: '+88%' },
  { id: 5, title: '망원 한강 야간 러닝 크루',  category: '러닝',    distance: '4.0km', accent: '#FF6B6B', ageGroup: '30s', emoji: '🌙', crowd: '35명 집결',   isHot: false, isSponsored: false, trend: '+5%'  },
  { id: 6, title: '강남 루프탑 바 싱글즈 나이트', category: '나이트아웃', distance: '5.2km', accent: '#FF6B6B', ageGroup: '30s', emoji: '🍹', crowd: '120명 대기', isHot: true,  isSponsored: true,  trend: '+67%' },
  { id: 7, title: '인사동 도예 원데이 클래스', category: '클래스',  distance: '6.4km', accent: '#00F0FF', ageGroup: '40s', emoji: '🏺', crowd: '22명 · 잔여 3석', isHot: false, isSponsored: false, trend: '+3%' },
  { id: 8, title: '이태원 글로벌 푸드 페스타',  category: '푸드',   distance: '7.1km', accent: '#FFDE00', ageGroup: '20s', emoji: '🍜', crowd: '230명 현장',  isHot: true,  isSponsored: false, trend: '+55%' },
];

export function EventsPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const filtered = filter === 'all' ? events : events.filter((e) => e.ageGroup === filter);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#0A0A0E]">
      {/* 헤더 */}
      <div className="shrink-0 px-5 pb-3 pt-[4.5rem]">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-white">지금 뜨는 핫스팟</h2>
            <p className="mt-0.5 text-[12.5px] text-white/40">내 주변 오프라인 이벤트 실시간 집계</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[#FFDE00]/25 bg-[#FFDE00]/08 px-2.5 py-1">
            <TrendingUp size={11} className="text-[#FFDE00]" />
            <span className="text-[11px] font-semibold text-[#FFDE00]">{filtered.length}개</span>
          </div>
        </div>

        {/* 필터 칩 */}
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
                style={{
                  borderColor: on ? `${f.accent}50` : 'rgba(255,255,255,0.1)',
                  backgroundColor: on ? `${f.accent}14` : 'rgba(255,255,255,0.03)',
                  color: on ? f.accent : 'rgba(255,255,255,0.4)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none' }}>
        <AnimatePresence mode="popLayout">
          {filtered.map((e, idx) => (
            <motion.button
              key={e.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ delay: idx * 0.035 }}
              className="mb-2.5 flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.985]"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderColor: e.isHot ? `${e.accent}28` : 'rgba(255,255,255,0.07)',
              }}
            >
              {/* 이모지 아이콘 */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[22px]"
                style={{ backgroundColor: `${e.accent}12` }}
              >
                {e.emoji}
              </div>

              {/* 콘텐츠 */}
              <div className="min-w-0 flex-1">
                {/* 상단 메타 */}
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ color: e.accent, backgroundColor: `${e.accent}14` }}
                  >
                    {e.category}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-white/35">
                    <MapPin size={9} />
                    {e.distance}
                  </span>
                  {e.isHot && (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-400">
                      <Flame size={9} fill="currentColor" />핫
                    </span>
                  )}
                  {e.isSponsored && (
                    <span className="ml-auto flex items-center gap-0.5 text-[9.5px] font-semibold text-white/30">
                      <Star size={8} className="text-white/25" />광고
                    </span>
                  )}
                  {!e.isSponsored && (
                    <span className="ml-auto text-[10px] font-bold" style={{ color: e.accent }}>{e.trend}</span>
                  )}
                </div>

                {/* 제목 */}
                <p className="truncate text-[14.5px] font-semibold text-white/90">{e.title}</p>

                {/* 인원 */}
                <div className="mt-1 flex items-center gap-1">
                  <Users size={10} style={{ color: e.accent }} />
                  <span className="text-[11px]" style={{ color: `${e.accent}cc` }}>{e.crowd}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Sparkles size={28} className="text-white/15" />
            <p className="text-[13px] text-white/35 text-center">이벤트가 없어요.<br />필터를 바꿔 보세요.</p>
          </div>
        )}

        <p className="mt-4 pb-2 text-center text-[10.5px] leading-relaxed text-white/28">
          행사 등록·광고 문의는 <span className="text-white/45">마이</span> 탭의「운영 · 문의」에서 메일로 보내 주세요.
        </p>
      </div>
    </div>
  );
}
