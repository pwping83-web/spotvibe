import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowUpRight, BellRing, TrendingUp } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SPOT_MOOD_IMAGES, type MoodImageKey } from '../constants/spotMoodImages';

interface Notification {
  id: number;
  title: string;
  desc: string;
  time: string;
  accent: string;
  group: 'today' | 'yesterday' | 'earlier';
  isNew?: boolean;
  moodKey: MoodImageKey;
}

const notifications: Notification[] = [
  { id: 1, title: '홍대 버스킹 거리 20대 밀집도 폭발!',      desc: '20대 여성 68명, 남성 42명 집결. 인디 밴드 공연 진행 중.',                  time: '방금 전',     accent: '#FFDE00', group: 'today',     isNew: true,  moodKey: 'busking'      },
  { id: 2, title: '성수동 팝업 오픈 직후 유동인구 급증!',     desc: '20대 여성 80명+ 현장 집결. 브랜드 팝업 효과 크게 나타나는 중.',            time: '23분 전',     accent: '#FFDE00', group: 'today',     isNew: true,  moodKey: 'retailCrowd'  },
  { id: 3, title: '여의도 한강공원 40대 밀집도 급증!',        desc: '무료 에어로빅 강좌 진행 중 확률 높음. 152명 활동 중.',                      time: '1시간 전',    accent: '#00F0FF', group: 'today',     isNew: false, moodKey: 'hanRiver'     },
  { id: 4, title: '강남 루프탑 바 30대 초밀집 감지!',         desc: '남녀 5:5 균형 잡힌 30대 싱글 그룹 집결. 금요일 저녁 핫스팟.',             time: '3시간 전',    accent: '#FF6B6B', group: 'today',     isNew: false, moodKey: 'nightlife'    },
  { id: 5, title: '연남동 플리마켓 20대 여성 핫스팟 확정',    desc: '타임세일 후 여성 비율 71% 급상승. 평균 체류 34분.',                        time: '어제 오후 6시', accent: '#FFDE00', group: 'yesterday', isNew: false, moodKey: 'retailCrowd'  },
  { id: 6, title: '망원 한강 30대 러닝 크루 집결',            desc: '매주 화·목 야간 러닝. 30대 남성 60% 건강 라이프스타일 핫스팟.',             time: '어제 오후 9시', accent: '#FF6B6B', group: 'yesterday', isNew: false, moodKey: 'hanRiver'     },
  { id: 7, title: '이태원 글로벌 푸드 페스타 최고치!',        desc: '외국인 포함 20대 230명 집결. SNS 바이럴로 예상 3배 방문.',               time: '2일 전',      accent: '#FFDE00', group: 'earlier',   isNew: false, moodKey: 'foodFest'     },
  { id: 8, title: '인사동 도예 클래스 40대+ 소모임',          desc: '40대 이상 여성 유저 주중 낮 모임 패턴 반복 감지.',                         time: '3일 전',      accent: '#00F0FF', group: 'earlier',   isNew: false, moodKey: 'outdoorActive'},
];

const GROUP_LABELS = { today: '오늘', yesterday: '어제', earlier: '이전' };
const GROUPS = ['today', 'yesterday', 'earlier'] as const;

export function NotificationsPage() {
  const newCount = notifications.filter((n) => n.isNew).length;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#0A0A0E]">
      {/* 헤더 */}
      <div className="shrink-0 px-5 pb-3 pt-[4.5rem]">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-white">AI 인사이트</h2>
            <p className="mt-0.5 text-[12.5px] text-white/40">핫스팟 변화를 실시간으로 분석해드려요</p>
          </div>
          {newCount > 0 && (
            <div className="flex items-center gap-1 rounded-full border border-[#FF6B6B]/25 bg-[#FF6B6B]/08 px-2.5 py-1">
              <BellRing size={11} className="text-[#FF6B6B]" />
              <span className="text-[11px] font-semibold text-[#FF6B6B]">새 {newCount}개</span>
            </div>
          )}
        </div>
      </div>

      {/* 타임라인 */}
      <div className="flex-1 overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none' }}>
        {GROUPS.map((groupKey) => {
          const items = notifications.filter((n) => n.group === groupKey);
          if (!items.length) return null;

          return (
            <div key={groupKey} className="mb-5">
              {/* 날짜 라벨 */}
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="text-[10.5px] font-bold uppercase tracking-widest text-white/30">
                  {GROUP_LABELS[groupKey]}
                </span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>

              <div className="relative space-y-2.5">
                {/* 타임라인 수직선 */}
                <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-white/10 via-white/05 to-transparent" />

                {items.map((n, idx) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3"
                  >
                    {/* 노드 */}
                    <div className="relative z-[1] shrink-0 mt-[3px]">
                      <div
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `${n.accent}14`,
                          border: `1px solid ${n.accent}35`,
                          boxShadow: n.isNew ? `0 0 10px ${n.accent}40` : 'none',
                        }}
                      >
                        {n.isNew
                          ? <TrendingUp size={13} style={{ color: n.accent }} />
                          : <Sparkles size={13} style={{ color: n.accent }} />
                        }
                      </div>
                    </div>

                    {/* 카드 */}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.99]"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderColor: n.isNew ? `${n.accent}25` : 'rgba(255,255,255,0.07)',
                      }}
                    >
                      {/* 무드 이미지 */}
                      <div className="relative h-24 w-full overflow-hidden">
                        <ImageWithFallback
                          src={SPOT_MOOD_IMAGES[n.moodKey]}
                          alt={n.title}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0E] via-[#0A0A0E]/30 to-transparent" />
                        {n.isNew && (
                          <span
                            className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                            style={{ backgroundColor: `${n.accent}22`, color: n.accent, border: `1px solid ${n.accent}40` }}
                          >
                            NEW
                          </span>
                        )}
                      </div>

                      {/* 텍스트 */}
                      <div className="flex items-start gap-2 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold leading-snug text-white/90">{n.title}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-white/45">{n.desc}</p>
                          <span className="mt-1.5 block text-[10px] text-white/28">{n.time}</span>
                        </div>
                        <div
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                          style={{ borderColor: `${n.accent}30` }}
                        >
                          <ArrowUpRight size={11} style={{ color: n.accent }} />
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-center gap-1.5 py-4 pb-2">
          <Sparkles size={12} className="text-white/20" />
          <span className="text-[10.5px] text-white/22">AI가 익명 위치 데이터만으로 분석 중</span>
        </div>
      </div>
    </div>
  );
}
