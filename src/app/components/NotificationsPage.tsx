import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowUpRight, BellRing, TrendingUp, Loader2 } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SPOT_MOOD_IMAGES, type MoodImageKey } from '../constants/spotMoodImages';
import {
  aiInsightMetroLabel,
  aiInsightUiBucketFromPreset,
  DEFAULT_EXPLORE_CENTER,
  nearestExplorePresetId,
  type AiInsightUiBucket,
} from '../constants/exploreRegions';
import type { AiInsightProfilePayload } from '@/lib/groqAiInsights';
import { fetchGroqInsightNotifications } from '@/lib/groqAiInsights';

interface Notification {
  id: number;
  title: string;
  desc: string;
  time: string;
  accent: string;
  group: 'today' | 'yesterday' | 'earlier';
  isNew?: boolean;
  moodKey: MoodImageKey;
  insightBucket: AiInsightUiBucket;
}

const ALL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    title: '홍대 버스킹 거리 20대 밀집도 폭발!',
    desc: '20대 여성 68명, 남성 42명 집결. 인디 밴드 공연 진행 중.',
    time: '방금 전',
    accent: '#FFDE00',
    group: 'today',
    isNew: true,
    moodKey: 'busking',
    insightBucket: 'seoul',
  },
  {
    id: 2,
    title: '성수동 팝업 오픈 직후 유동인구 급증!',
    desc: '20대 여성 80명+ 현장 집결. 브랜드 팝업 효과 크게 나타나는 중.',
    time: '23분 전',
    accent: '#FFDE00',
    group: 'today',
    isNew: true,
    moodKey: 'retailCrowd',
    insightBucket: 'seoul',
  },
  {
    id: 3,
    title: '여의도 한강공원 40대 밀집도 급증!',
    desc: '무료 에어로빅 강좌 진행 중 확률 높음. 152명 활동 중.',
    time: '1시간 전',
    accent: '#00F0FF',
    group: 'today',
    isNew: false,
    moodKey: 'hanRiver',
    insightBucket: 'seoul',
  },
  {
    id: 4,
    title: '강남 루프탑 바 30대 초밀집 감지!',
    desc: '남녀 5:5 균형 잡힌 30대 싱글 그룹 집결. 금요일 저녁 핫스팟.',
    time: '3시간 전',
    accent: '#FF6B6B',
    group: 'today',
    isNew: false,
    moodKey: 'nightlife',
    insightBucket: 'seoul',
  },
  {
    id: 5,
    title: '연남동 플리마켓 20대 여성 핫스팟 확정',
    desc: '타임세일 후 여성 비율 71% 급상승. 평균 체류 34분.',
    time: '어제 오후 6시',
    accent: '#FFDE00',
    group: 'yesterday',
    isNew: false,
    moodKey: 'retailCrowd',
    insightBucket: 'seoul',
  },
  {
    id: 6,
    title: '망원 한강 30대 러닝 크루 집결',
    desc: '매주 화·목 야간 러닝. 30대 남성 60% 건강 라이프스타일 핫스팟.',
    time: '어제 오후 9시',
    accent: '#FF6B6B',
    group: 'yesterday',
    isNew: false,
    moodKey: 'hanRiver',
    insightBucket: 'seoul',
  },
  {
    id: 7,
    title: '이태원 글로벌 푸드 페스타 최고치!',
    desc: '외국인 포함 20대 230명 집결. SNS 바이럴로 예상 3배 방문.',
    time: '2일 전',
    accent: '#FFDE00',
    group: 'earlier',
    isNew: false,
    moodKey: 'foodFest',
    insightBucket: 'seoul',
  },
  {
    id: 8,
    title: '인사동 도예 클래스 40대+ 소모임',
    desc: '40대 이상 여성 유저 주중 낮 모임 패턴 반복 감지.',
    time: '3일 전',
    accent: '#00F0FF',
    group: 'earlier',
    isNew: false,
    moodKey: 'outdoorActive',
    insightBucket: 'seoul',
  },

  {
    id: 20,
    title: '광안대교 야경로 30대 인파 급증',
    desc: '금·토 밤 시간대 여성 비율이 평소 대비 높게 집계됐어요. 해안 산책 동선이 길어졌어요.',
    time: '방금 전',
    accent: '#38BDF8',
    group: 'today',
    isNew: true,
    moodKey: 'hanRiver',
    insightBucket: 'busan',
  },
  {
    id: 21,
    title: '해운대 마린시티 라운지 20·30대 몰림',
    desc: '야경·클럽 태그와 E 성향 MBTI 패턴이 겹치는 익명 집계가 올라가 있어요.',
    time: '42분 전',
    accent: '#A855F7',
    group: 'today',
    isNew: true,
    moodKey: 'nightlife',
    insightBucket: 'busan',
  },
  {
    id: 22,
    title: '민락 횟집 골목 저녁 피크',
    desc: '맛집·수다 태그 + 30·40대 남성 인파 비중이 두껍게 나왔어요.',
    time: '어제 오후 7시',
    accent: '#FB923C',
    group: 'yesterday',
    isNew: false,
    moodKey: 'foodFest',
    insightBucket: 'busan',
  },

  {
    id: 30,
    title: '평촌 카페거리 주말 오후 대기 길어짐',
    desc: '카페·수다 태그 + 30·40대 여성 익명 패턴이 평소보다 높게 잡혀 있어요.',
    time: '1시간 전',
    accent: '#D97706',
    group: 'today',
    isNew: false,
    moodKey: 'retailCrowd',
    insightBucket: 'gyeonggi',
  },

  {
    id: 40,
    title: '강릉 경포 야간 산책 인파 상승',
    desc: '야외·야경 태그가 동시에 올라가는 시간대예요. 20대 커플 동선이 길어졌어요.',
    time: '2시간 전',
    accent: '#4ADE80',
    group: 'today',
    isNew: false,
    moodKey: 'hanRiver',
    insightBucket: 'coast',
  },
  {
    id: 41,
    title: '제주 협재 일몰 구간 20대 몰림',
    desc: '소풍·야외 태그 집계가 피크예요. 여성 인파 비율이 높게 나왔어요.',
    time: '어제 오후 5시',
    accent: '#FFDE00',
    group: 'yesterday',
    isNew: false,
    moodKey: 'outdoorActive',
    insightBucket: 'coast',
  },
];

const GROUP_LABELS = { today: '오늘', yesterday: '어제', earlier: '이전' };
const GROUPS = ['today', 'yesterday', 'earlier'] as const;

function notificationsForBucket(bucket: AiInsightUiBucket): Notification[] {
  const pick = (b: AiInsightUiBucket) => (n: Notification) => n.insightBucket === b;
  if (bucket === 'seoul') return ALL_NOTIFICATIONS.filter(pick('seoul'));
  if (bucket === 'busan') return ALL_NOTIFICATIONS.filter(pick('busan'));
  if (bucket === 'gyeonggi') return ALL_NOTIFICATIONS.filter(pick('gyeonggi'));
  if (bucket === 'coast') return ALL_NOTIFICATIONS.filter(pick('coast'));
  return ALL_NOTIFICATIONS.filter(pick('seoul'));
}

export function NotificationsPage({
  exploreAnchor = DEFAULT_EXPLORE_CENTER,
  aiNotificationsPaused = false,
  aiProfile,
}: {
  exploreAnchor?: [number, number];
  aiNotificationsPaused?: boolean;
  aiProfile: AiInsightProfilePayload;
}) {
  const nearestPresetId = useMemo(() => nearestExplorePresetId(exploreAnchor), [exploreAnchor]);
  const metroLabel = useMemo(() => aiInsightMetroLabel(nearestPresetId), [nearestPresetId]);
  const bucket = useMemo(() => aiInsightUiBucketFromPreset(nearestPresetId), [nearestPresetId]);
  const staticForBucket = useMemo(() => notificationsForBucket(bucket), [bucket]);

  const groqKey = (import.meta.env.VITE_GROQ_API_KEY ?? '').trim();
  const [aiItems, setAiItems] = useState<Notification[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const profileKey = useMemo(() => JSON.stringify(aiProfile), [aiProfile]);

  useEffect(() => {
    if (aiNotificationsPaused || !groqKey) {
      setAiItems(null);
      setAiLoading(false);
      setAiError(null);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;
    setAiLoading(true);
    setAiError(null);
    setAiItems(null);

    void fetchGroqInsightNotifications(
      groqKey,
      { profile: aiProfile, metroLabel, regionBucket: bucket },
      ac.signal,
    )
      .then((cards) => {
        if (cancelled) return;
        setAiItems(
          cards.map((c) => ({
            ...c,
            insightBucket: bucket,
          })),
        );
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setAiItems(null);
        setAiError(e instanceof Error ? e.message : 'AI 요청 실패');
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [aiNotificationsPaused, groqKey, metroLabel, bucket, profileKey, aiProfile]);

  const visible = useMemo(() => {
    if (aiNotificationsPaused || !groqKey) return staticForBucket;
    if (aiItems && aiItems.length > 0) return aiItems;
    return staticForBucket;
  }, [aiNotificationsPaused, groqKey, aiItems, staticForBucket]);

  const newCount = useMemo(() => visible.filter((n) => n.isNew).length, [visible]);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#0A0A0E]">
      <div className="shrink-0 px-5 pb-3 pt-[4.5rem]">
        <div className="flex items-end justify-between">
          <div className="min-w-0 pr-2">
            <h2 className="text-[22px] font-bold tracking-tight text-white">AI 인사이트</h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-white/42">
              마이에서 설정한 연령·성별·선호 시간을 참고해 경기 기준으로 장소형 인사이트를 보여줘요.
            </p>
            <p className="mt-1 text-[10px] leading-snug text-white/28">
              {aiNotificationsPaused ? '지금은 마이에서 AI 추천 휴식 중이라 샘플 카드만 보여요.' : null}
            </p>
          </div>
          {newCount > 0 && (
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#FF6B6B]/25 bg-[#FF6B6B]/08 px-2.5 py-1">
              <BellRing size={11} className="text-[#FF6B6B]" />
              <span className="text-[11px] font-semibold text-[#FF6B6B]">새 {newCount}개</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none' }}>
        {aiLoading && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/25 bg-[#00F0FF]/08 py-3 text-[12px] font-semibold text-[#00F0FF]">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            Groq AI가 맞춤 카드를 만들고 있어요…
          </div>
        )}
        {!aiNotificationsPaused && groqKey && aiError && !aiLoading && (
          <p className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-100/90">
            AI 생성에 실패해 샘플 카드를 보여요. ({aiError})
          </p>
        )}
        {GROUPS.map((groupKey) => {
          const items = visible.filter((n) => n.group === groupKey);
          if (!items.length) return null;

          return (
            <div key={groupKey} className="mb-5">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="text-[10.5px] font-bold uppercase tracking-widest text-white/30">
                  {GROUP_LABELS[groupKey]}
                </span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>

              <div className="relative space-y-2.5">
                <div className="absolute bottom-4 left-[15px] top-4 w-px bg-gradient-to-b from-white/10 via-white/05 to-transparent" />

                {items.map((n, idx) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3"
                  >
                    <div className="relative z-[1] mt-[3px] shrink-0">
                      <div
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `${n.accent}14`,
                          border: `1px solid ${n.accent}35`,
                          boxShadow: n.isNew ? `0 0 10px ${n.accent}40` : 'none',
                        }}
                      >
                        {n.isNew ? (
                          <TrendingUp size={13} style={{ color: n.accent }} />
                        ) : (
                          <Sparkles size={13} style={{ color: n.accent }} />
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.99]"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderColor: n.isNew ? `${n.accent}25` : 'rgba(255,255,255,0.07)',
                      }}
                    >
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
                            style={{
                              backgroundColor: `${n.accent}22`,
                              color: n.accent,
                              border: `1px solid ${n.accent}40`,
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </div>

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

        <div className="flex flex-col items-center justify-center gap-1 py-4 pb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-white/20" />
            <span className="text-center text-[10.5px] text-white/22">
              {aiNotificationsPaused || !groqKey || aiError || !aiItems?.length
                ? null
                : '위 카드 문구는 Groq AI가 마이 조건·권역에 맞춰 생성했어요(가상 시나리오).'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
