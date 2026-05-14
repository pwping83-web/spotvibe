import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/App';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  Clock,
  MapPinned,
  MessageCircle,
  Mail,
  Megaphone,
  PartyPopper,
  Lightbulb,
  LogOut,
  UserX,
  Star,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { InquiryContactDialog } from './InquiryContactDialog';
import { LocationRealtimeInfoBlock } from './LocationRealtimeInfoBlock';
import { BusinessInfoSection } from './BusinessInfoSection';
import { ExploreRegionFlowPanel } from './ExploreRegionFlowPanel';
import type { InquiryKind } from '../constants/inquiry';
import type { ExploreRegionPreset } from '../constants/exploreRegions';
import {
  loadSavedExplorePlaces,
  persistSavedExplorePlaces,
  savedPlaceToPreset,
  SAVED_EXPLORE_PLACES_MAX,
  type SavedExplorePlace,
} from '@/app/lib/savedExplorePlaces';
import { AGE_GENDER_COLORS } from '../constants/ageGenderColors';

export type MobilityProfile = 'car_owner' | 'kickboard_license' | 'pedestrian_ddareungi';

const MOCK_KAKAO_PROFILE = { ageRangeLabel: '30대', genderLabel: '남성', ageAccent: '#FF6B6B' } as const;

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

const TIME_SLOTS = [
  { id: 'lunch',     label: '점심',   sub: '12:00 – 14:00' },
  { id: 'afternoon', label: '오후',   sub: '14:00 – 18:00' },
  { id: 'evening',   label: '저녁',   sub: '18:00 – 22:00' },
  { id: 'late',      label: '늦은 밤', sub: '22:00 – 02:00' },
] as const;

const MOBILITY_OPTIONS: { id: MobilityProfile; emoji: string; title: string; sub: string; accent: string }[] = [
  { id: 'car_owner',            emoji: '🚗', title: '자차 보유',           sub: '운전·주차 기준으로 길 안내',       accent: '#00F0FF' },
  { id: 'kickboard_license',    emoji: '🛴', title: '킥보드 면허 있음',     sub: '킥·PM 대여 있는 동선 우선',       accent: '#FFDE00' },
  { id: 'pedestrian_ddareungi', emoji: '🚶', title: '뚜벅이 (따릉이 선호)', sub: '걷기·따릉이 타기 좋은 코스 위주', accent: '#FF6B6B' },
];

function MiniToggle({
  on,
  accent,
  onToggle,
  ariaLabel,
}: {
  on: boolean;
  accent: string;
  onToggle: () => void;
  /** 접근성·길게 눌러 힌트 — 없으면 aria-pressed만 의미 전달 */
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={on}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
      style={{ backgroundColor: on ? accent : 'rgba(255,255,255,0.14)' }}
    >
      <motion.div
        className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow"
        animate={{ left: on ? 22 : 3 }}
        transition={{ type: 'spring', stiffness: 440, damping: 30 }}
      />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 mt-7 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/28">{children}</p>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm ${className ?? 'p-4'}`}
    >
      {children}
    </div>
  );
}

export type LocationMode = 'my_location' | 'explore';

const AGE_RANGES = ['10대', '20대', '30대', '40대', '50대', '60대+'] as const;
const GENDERS = ['남성', '여성'] as const;

export type AgeRange = typeof AGE_RANGES[number];
export type Gender = typeof GENDERS[number];

interface MyPageProps {
  isAdmin: boolean;
  ageRange: AgeRange;
  onAgeRangeChange: (v: AgeRange) => void;
  gender: Gender;
  onGenderChange: (v: Gender) => void;
  mobilityProfile: MobilityProfile;
  onMobilityProfileChange: (v: MobilityProfile) => void;
  locationMode: LocationMode;
  onLocationModeChange: (mode: LocationMode) => void;
  /** 선호 활동 요일 0=월 … 6=일 — Supabase notification_weekdays */
  notificationWeekdays: Set<number>;
  onNotificationWeekdaysChange: (v: Set<number>) => void;
  /** lunch | afternoon | evening | late — Supabase notification_time_slots */
  notificationTimeSlots: Set<string>;
  onNotificationTimeSlotsChange: (v: Set<string>) => void;
  aiNotificationsPaused: boolean;
  onAiNotificationsPausedChange: (v: boolean) => void;
  /** Supabase contribution_points (null이면 아직 로드 전) */
  gamificationPoints: number | null;
  onGamificationRefetch: () => void;
  /** Supabase·로컬 세션 종료 */
  onLogout?: () => void;
  /** 프로필 삭제 후 로그아웃 */
  onDeleteAccount?: () => Promise<void>;
  explorePresets: ExploreRegionPreset[];
  onApplyExploreRegion: (preset: ExploreRegionPreset) => void;
  /** 지도 탐색 중심 — 자주 찾는 위치 저장에 사용 */
  exploreAnchor: [number, number];
  /** 관리자만: 지도 테스트(가상 인구·데모) 미리보기 — 이 기기 로컬에만 저장 */
  adminMapTestPreview: boolean;
  onAdminMapTestPreviewChange: (on: boolean) => void;
  /** 시각장애인 이웃 도움 메시지 수신(음성 안내) */
  viNeighborTipsOptIn: boolean;
  onViNeighborTipsOptInChange: (v: boolean) => void;
}

export function MyPage({
  isAdmin,
  ageRange,
  onAgeRangeChange,
  gender,
  onGenderChange,
  mobilityProfile,
  onMobilityProfileChange,
  locationMode,
  onLocationModeChange,
  notificationWeekdays,
  onNotificationWeekdaysChange,
  notificationTimeSlots,
  onNotificationTimeSlotsChange,
  aiNotificationsPaused,
  onAiNotificationsPausedChange,
  gamificationPoints,
  onGamificationRefetch,
  onLogout,
  onDeleteAccount,
  explorePresets,
  onApplyExploreRegion,
  exploreAnchor,
  adminMapTestPreview,
  onAdminMapTestPreviewChange,
  viNeighborTipsOptIn,
  onViNeighborTipsOptInChange,
}: MyPageProps) {
  const { userId } = useAuth();
  /** 제보 포인트 안내 펼침 */
  const [pointsSectionOpen, setPointsSectionOpen] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);

  /** MBTI 질문 모드 */
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryKind, setInquiryKind] = useState<InquiryKind>('improvement');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savedExplorePlaces, setSavedExplorePlaces] = useState<SavedExplorePlace[]>(() =>
    loadSavedExplorePlaces(),
  );
  const [favLabelDraft, setFavLabelDraft] = useState('');

  useEffect(() => {
    persistSavedExplorePlaces(savedExplorePlaces);
  }, [savedExplorePlaces]);

  const agc = AGE_GENDER_COLORS[ageRange] ?? AGE_GENDER_COLORS['30대'];
  const genderColor =
    gender === '남성' ? agc.male :
    gender === '여성' ? agc.female :
    agc.accent;
  const accent = genderColor;
  const cyan = '#00F0FF';

  const toggleWeekday = (i: number) => {
    const n = new Set(notificationWeekdays);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    onNotificationWeekdaysChange(n);
  };
  const toggleTimeSlot = (id: string) => {
    const n = new Set(notificationTimeSlots);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    onNotificationTimeSlotsChange(n);
  };

  const GAMIFICATION_PT_CAP = 100;
  const displayPts = isAdmin ? GAMIFICATION_PT_CAP : (gamificationPoints ?? 0);
  const ptFillPct = isAdmin ? 100 : Math.min(100, ((gamificationPoints ?? 0) / GAMIFICATION_PT_CAP) * 100);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#0A0A0E]">
      <div className="flex-1 overflow-y-auto px-5 pb-28 pt-[4.5rem]" style={{ scrollbarWidth: 'none' }}>

        {/* 프로필 카드 */}
        <div className="mb-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          {/* 상단: 아바타 + 이름 + 수정 버튼 */}
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ background: `${accent}16` }}
            >
              👤
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-bold text-white">카카오 연동</span>
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: `${accent}18`, color: accent }}
                >
                  {/* 나이대 남/여 색 원 */}
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: agc.male, boxShadow: `0 0 4px ${agc.male}99` }}
                  />
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: agc.female, boxShadow: `0 0 4px ${agc.female}99` }}
                  />
                  {ageRange} · {gender}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <p className="flex items-center gap-1 text-[11px] text-white/35">
                  <MessageCircle size={10} />
                  {editingProfile ? '아래에서 직접 수정할 수 있어요' : '카카오 값과 다르면 직접 수정하세요'}
                </p>
                {gamificationPoints !== null && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#A855F7' }}
                  >
                    📍 {gamificationPoints}pt
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingProfile((v) => !v)}
              className="shrink-0 rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold transition-all active:scale-95"
              style={{
                borderColor: editingProfile ? `${accent}50` : 'rgba(255,255,255,0.12)',
                backgroundColor: editingProfile ? `${accent}14` : 'transparent',
                color: editingProfile ? accent : 'rgba(255,255,255,0.5)',
              }}
            >
              {editingProfile ? '완료' : '수정'}
            </button>
          </div>

          {/* 수정 폼 */}
          <AnimatePresence>
            {editingProfile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 flex flex-col gap-3.5 border-t border-white/[0.07] pt-4">
                  {/* 연령대 */}
                  <div>
                    <p className="mb-2 text-[11.5px] font-semibold text-white/55">연령대</p>
                    <div className="flex flex-wrap gap-1.5">
                      {AGE_RANGES.map((a) => {
                        const on = ageRange === a;
                        const c = AGE_GENDER_COLORS[a] ?? AGE_GENDER_COLORS['30대'];
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => onAgeRangeChange(a)}
                            className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
                            style={{
                              borderColor: on ? `${c.accent}55` : 'rgba(255,255,255,0.1)',
                              backgroundColor: on ? `${c.accent}16` : 'transparent',
                              color: on ? c.accent : 'rgba(255,255,255,0.45)',
                            }}
                          >
                            {/* 남/여 색상 원 */}
                            <span className="flex items-center gap-0.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: on ? c.male : `${c.male}66` }}
                              />
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: on ? c.female : `${c.female}66` }}
                              />
                            </span>
                            {a}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 성별 */}
                  <div>
                    <p className="mb-2 text-[11.5px] font-semibold text-white/55">성별</p>
                    <div className="flex gap-1.5">
                      {GENDERS.map((g) => {
                        const on = gender === g;
                        const dotColor =
                          g === '남성' ? agc.male :
                          g === '여성' ? agc.female :
                          null;
                        const btnAccent =
                          g === '남성' ? agc.male :
                          g === '여성' ? agc.female :
                          agc.accent;
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => onGenderChange(g)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-[12px] font-semibold transition-all active:scale-95"
                            style={{
                              borderColor: on ? `${btnAccent}55` : 'rgba(255,255,255,0.1)',
                              backgroundColor: on ? `${btnAccent}18` : 'transparent',
                              color: on ? btnAccent : 'rgba(255,255,255,0.45)',
                            }}
                          >
                            {dotColor && (
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: dotColor,
                                  opacity: on ? 1 : 0.35,
                                  boxShadow: on ? `0 0 6px ${dotColor}88` : 'none',
                                }}
                              />
                            )}
                            {g === '남성' ? '♂ 남성' : g === '여성' ? '♀ 여성' : g}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[10.5px] text-white/25">
                    ※ 수정한 정보는 AI 인사이트·알림 문구에 참고되며, 카카오 계정에는 저장되지 않아요.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isAdmin && (
          <>
            <SectionLabel>관리자 지도 테스트 모드</SectionLabel>
            <Card>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAdminMapTestPreviewChange(false)}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-2.5 text-center transition-all active:scale-[0.99]"
                  style={{
                    borderColor: !adminMapTestPreview ? 'rgba(0,240,255,0.45)' : 'rgba(255,255,255,0.1)',
                    backgroundColor: !adminMapTestPreview ? 'rgba(0,240,255,0.1)' : 'transparent',
                  }}
                >
                  <span className="text-[12.5px] font-bold" style={{ color: !adminMapTestPreview ? '#00F0FF' : 'rgba(255,255,255,0.45)' }}>
                    실서비스 지도
                  </span>
                  <span className="text-[9.5px] text-white/30">실제 주변·제보 UI</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAdminMapTestPreviewChange(true)}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-2.5 text-center transition-all active:scale-[0.99]"
                  style={{
                    borderColor: adminMapTestPreview ? 'rgba(168,85,247,0.55)' : 'rgba(255,255,255,0.1)',
                    backgroundColor: adminMapTestPreview ? 'rgba(168,85,247,0.12)' : 'transparent',
                  }}
                >
                  <span className="text-[12.5px] font-bold" style={{ color: adminMapTestPreview ? '#C084FC' : 'rgba(255,255,255,0.45)' }}>
                    테스트 지도
                  </span>
                  <span className="text-[9.5px] text-white/30">가상 인구·데모·근처 화재 SOS 시뮬</span>
                </button>
              </div>
            </Card>
            <Card className="mt-3">
              <Link
                to="/admin/sos-moderation"
                className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 py-3 text-center text-[13px] font-bold text-amber-100 active:scale-[0.99]"
              >
                SOS 모더레이션 · 신고 검토
              </Link>
            </Card>
          </>
        )}

        {/* 이동 프로필 — 토글로 상황 표시 (단일 선택) */}
        <SectionLabel>나만의 이동 설정</SectionLabel>
        <Card>
          <p className="mb-3 text-[11.5px] leading-relaxed text-white/40">
            오늘 어떻게 움직일지 알려 주면, 팝업 안내 톤이 맞춰져요. <span className="text-white/25">(한 가지만 켤 수 있어요)</span>
          </p>
          <div className="flex flex-col gap-2">
            {MOBILITY_OPTIONS.map((opt) => {
              const on = mobilityProfile === opt.id;
              return (
                <div
                  key={opt.id}
                  className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors"
                  style={{
                    borderColor: on ? `${opt.accent}38` : 'rgba(255,255,255,0.07)',
                    backgroundColor: on ? `${opt.accent}12` : 'rgba(255,255,255,0.02)',
                    boxShadow: on ? `0 12px 36px -18px ${opt.accent}55` : undefined,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onMobilityProfileChange(opt.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition-all active:scale-[0.99]"
                  >
                    <span className="text-xl leading-none">{opt.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold" style={{ color: on ? opt.accent : 'rgba(255,255,255,0.82)' }}>
                        {opt.title}
                      </p>
                      <p className="text-[11px] text-white/35">{opt.sub}</p>
                    </div>
                  </button>
                  <MiniToggle
                    on={on}
                    accent={opt.accent}
                    onToggle={() => {
                      if (!on) onMobilityProfileChange(opt.id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </Card>

        <SectionLabel>이웃 도움 음성</SectionLabel>
        <Card>
          <div className="flex items-center gap-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-white/88">시각장애인 · 이웃 도움 메시지 받기</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/40">
                켜 두면 지도에서 <b className="text-white/55">탐색 위치(explore_lat/lng)</b>가 있는 다른 이용자가 짧은 위험 안내를 보낼 수 있고, 앱이 <b className="text-white/55">한국어 음성</b>으로 읽어 줍니다. 장난·욕설은 제재 대상이에요. 같은 사람에게 1시간에 최대 6통까지 옵니다.
              </p>
            </div>
            <MiniToggle
              on={viNeighborTipsOptIn}
              accent="#60A5FA"
              ariaLabel="이웃 도움 메시지 수신"
              onToggle={() => onViNeighborTipsOptInChange(!viNeighborTipsOptIn)}
            />
          </div>
        </Card>

        {/* AI 추천 — 선호 활동 시간 위에 배치 */}
        <SectionLabel>AI 추천</SectionLabel>
        <Card>
          <div className="flex items-center gap-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-white/88">
                {aiNotificationsPaused ? '💤 AI 추천 휴식 중' : '✨ AI 맞춤 추천 플레이'}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/40">
                {aiNotificationsPaused
                  ? '내일 다시 멋진 스팟을 찾아올게요.'
                  : '알림 탭「AI 인사이트」에 Groq AI가 마이에서 설정한 연령·성별·선호 시간과 탐색 권역을 참고해 장소 안내 카드 문구를 만들어요.'}
              </p>
            </div>
            <MiniToggle
              on={!aiNotificationsPaused}
              accent="#00F0FF"
              onToggle={() => onAiNotificationsPausedChange(!aiNotificationsPaused)}
            />
          </div>
        </Card>

        {/* 선호 시간 */}
        <SectionLabel>선호 활동 시간</SectionLabel>
        <Card>
          {/* 요일 */}
          <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-white/70">
            <Clock size={13} style={{ color: cyan }} />
            요일
          </div>
          <p className="mb-2.5 text-[11px] text-white/35">자주 나가는 요일을 선택해 주세요.</p>
          <div className="mb-5 flex gap-1.5 flex-wrap">
            {WEEKDAYS.map((label, i) => {
              const on = notificationWeekdays.has(i);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleWeekday(i)}
                  className="rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
                  style={{
                    borderColor: on ? cyan : 'rgba(255,255,255,0.1)',
                    backgroundColor: on ? `${cyan}14` : 'transparent',
                    color: on ? cyan : 'rgba(255,255,255,0.38)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 시간대 */}
          <div className="mb-1 text-[12.5px] font-semibold text-white/70">시간대</div>
          <p className="mb-2.5 text-[11px] text-white/35">
            활동 시간대를 선택해 주세요. <span className="text-white/25">(복수 선택 가능)</span>
          </p>
          <div className="flex flex-col gap-1.5">
            {TIME_SLOTS.map((slot) => {
              const on = notificationTimeSlots.has(slot.id);
              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-all active:scale-[0.99]"
                  style={{
                    borderColor: on ? 'rgba(255,222,0,0.35)' : 'rgba(255,255,255,0.07)',
                    backgroundColor: on ? 'rgba(255,222,0,0.08)' : 'transparent',
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleTimeSlot(slot.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleTimeSlot(slot.id);
                      }
                    }}
                    className="min-w-0 flex-1 cursor-pointer py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#FFDE00]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0E]"
                  >
                    <span className="text-[13px] font-semibold" style={{ color: on ? '#FFDE00' : 'rgba(255,255,255,0.65)' }}>
                      {slot.label}
                    </span>
                    <span className="ml-2 text-[11px] text-white/30">{slot.sub}</span>
                  </div>
                  <MiniToggle on={on} accent="#FFDE00" onToggle={() => toggleTimeSlot(slot.id)} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="mt-7 p-0 overflow-hidden">
          <button
            type="button"
            onClick={() => setPointsSectionOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3.5 text-left transition-colors active:bg-white/[0.04]"
            aria-expanded={pointsSectionOpen}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white/90">현장 제보로 쌓는 포인트</p>
              <p className="mt-0.5 text-[10px] text-white/30">
                {pointsSectionOpen ? '탭하여 접기' : '탭하여 안내'}
              </p>
              <div className="mt-2 h-1 max-w-[140px] overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full"
                  initial={false}
                  animate={{ width: `${ptFillPct}%` }}
                  transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                  style={{ background: 'linear-gradient(90deg, #A855F7, #FFDE00, #00F0FF)' }}
                />
              </div>
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[10px] font-bold text-white/45"
              aria-hidden
            >
              pt
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[26px] font-black tabular-nums leading-none" style={{ color: '#A855F7' }}>
                {gamificationPoints !== null ? displayPts : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-white/35">{isAdmin ? 'pt · 관리' : 'pt'}</p>
            </div>
            <motion.span
              animate={{ rotate: pointsSectionOpen ? 180 : 0 }}
              transition={{ duration: 0.22 }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/45"
            >
              <ChevronDown size={18} strokeWidth={2.2} aria-hidden />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {pointsSectionOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-white/[0.07]"
              >
                <div className="px-4 pb-4 pt-1">
                  <p className="text-[11px] leading-relaxed text-white/38">
                    사진 제보가 AI 검증을 통과하면{' '}
                    <span className="font-semibold text-[#00F0FF]">+10pt</span>가 쌓여요. 포인트는 제보·이벤트 품질
                    개선용이며, 지도에서 다른 이용자를 찾거나 연결하는 기능은 제공하지 않습니다.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
        {/* 위치 모드 */}
        <SectionLabel>위치 설정</SectionLabel>
        <Card>
          <p className="mb-3 text-[11.5px] text-white/40">지도에서 볼 위치를 선택하세요.</p>
          <div className="flex flex-col gap-2">
            {/* 내 위치 */}
            <button
              type="button"
              onClick={() => onLocationModeChange('my_location')}
              className="flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.99]"
              style={{
                borderColor: locationMode === 'my_location' ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.07)',
                backgroundColor: locationMode === 'my_location' ? 'rgba(0,240,255,0.08)' : 'transparent',
              }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(0,240,255,0.10)' }}
              >
                <MapPinned size={18} style={{ color: '#00F0FF' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold" style={{ color: locationMode === 'my_location' ? '#00F0FF' : 'rgba(255,255,255,0.80)' }}>
                  내 위치
                </p>
                <p className="text-[11px] text-white/35">GPS로 현재 위치 기반 탐색</p>
              </div>
              <div
                className="h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: locationMode === 'my_location' ? '#00F0FF' : 'rgba(255,255,255,0.22)' }}
              >
                {locationMode === 'my_location' && <div className="h-2 w-2 rounded-full bg-[#00F0FF]" />}
              </div>
            </button>

            {/* 다른 지역 알아보기 */}
            <button
              type="button"
              onClick={() => onLocationModeChange('explore')}
              className="flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.99]"
              style={{
                borderColor: locationMode === 'explore' ? 'rgba(255,222,0,0.4)' : 'rgba(255,255,255,0.07)',
                backgroundColor: locationMode === 'explore' ? 'rgba(255,222,0,0.08)' : 'transparent',
              }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(255,222,0,0.10)' }}
              >
                <span className="text-lg">🗺️</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold" style={{ color: locationMode === 'explore' ? '#FFDE00' : 'rgba(255,255,255,0.80)' }}>
                  다른 지역 알아보기
                </p>
                <p className="text-[11px] text-white/35">광역 → 동네 순으로 고른 뒤 확인하면 지도로 이동해요</p>
              </div>
              <div
                className="h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: locationMode === 'explore' ? '#FFDE00' : 'rgba(255,255,255,0.22)' }}
              >
                {locationMode === 'explore' && <div className="h-2 w-2 rounded-full bg-[#FFDE00]" />}
              </div>
            </button>
          </div>

          {locationMode === 'explore' && (
            <ExploreRegionFlowPanel
              variant="embedded"
              explorePresets={explorePresets}
              onApply={onApplyExploreRegion}
            />
          )}
        </Card>

        <SectionLabel>실시간 위치·분포 안내</SectionLabel>
        <Card className="!p-3.5">
          <LocationRealtimeInfoBlock className="text-[11px] leading-relaxed text-white/48" />
          <p className="mt-3 text-[10px] text-white/30">
            법적 효력 있는 고지는{' '}
            <Link to="/privacy" className="text-[#00F0FF]/70 underline underline-offset-2 hover:text-[#00F0FF]">
              개인정보 처리방침
            </Link>
            을 참고하세요.
          </p>
        </Card>

        <SectionLabel>자주 찾는 위치</SectionLabel>
        <Card>
          <p className="mb-1 text-[11.5px] leading-relaxed text-white/45">
            즐겨찾기처럼 이름만 붙여 두면, 여기서 한 번에 지도로 보낼 수 있어요. 지도 홈의 「다른 지역 알아보기」나 「지역」버튼으로 맞춘 뒤 저장하는 걸 추천해요.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              type="text"
              value={favLabelDraft}
              onChange={(e) => setFavLabelDraft(e.target.value)}
              placeholder="예: 직장 앞, 헬스장, 자주 가는 한강"
              maxLength={28}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#00F0FF]/40"
            />
            <button
              type="button"
              onClick={() => {
                const t = favLabelDraft.trim();
                if (t.length < 1) {
                  toast.error('이름을 한 글자 이상 적어 주세요.');
                  return;
                }
                const id = `fav-${Date.now()}`;
                const next: SavedExplorePlace = {
                  id,
                  label: t,
                  lat: exploreAnchor[0],
                  lng: exploreAnchor[1],
                };
                setSavedExplorePlaces((prev) => [next, ...prev].slice(0, SAVED_EXPLORE_PLACES_MAX));
                setFavLabelDraft('');
                toast.success('자주 찾는 위치에 저장했어요.');
              }}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#00F0FF]/45 bg-[#00F0FF]/12 px-4 py-2.5 text-[12.5px] font-bold text-[#00F0FF] transition-all active:scale-[0.98]"
            >
              <Star size={15} strokeWidth={2.2} />
              지금 지도 중심으로 저장
            </button>
          </div>
          {savedExplorePlaces.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {savedExplorePlaces.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onApplyExploreRegion(savedPlaceToPreset(s));
                    }}
                    className="min-w-0 flex-1 text-left transition-opacity active:opacity-80"
                  >
                    <p className="truncate text-[13px] font-bold text-white/90">{s.label}</p>
                    <p className="text-[10px] text-white/35">탭하면 지도로 이동 · 다른 지역 모드로 전환돼요</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSavedExplorePlaces((prev) => prev.filter((x) => x.id !== s.id))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all active:scale-95 hover:border-red-400/40 hover:text-red-300"
                    aria-label={`${s.label} 삭제`}
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-center text-[11px] text-white/30">아직 저장된 곳이 없어요.</p>
          )}
        </Card>

        <div className="mt-7">
          <BusinessInfoSection />
        </div>

        {/* 운영 · 문의 (개선 제안 / 광고·행사) */}
        <div className="mt-7">
        <Card>
          <p className="mb-3 text-[11.5px] leading-relaxed text-white/45">
            서비스 개선이나 광고·행사 관련 문의는 아래에서 남겨 주세요.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setInquiryKind('improvement');
                setInquiryOpen(true);
              }}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-left transition-all active:scale-[0.99]"
            >
              <Lightbulb size={18} className="text-[#FFDE00]" />
              <span className="text-[12.5px] font-bold text-white/90">개선 제안</span>
              <span className="text-[10px] leading-snug text-white/35">버그·아이디어</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInquiryKind('ad');
                setInquiryOpen(true);
              }}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-left transition-all active:scale-[0.99]"
            >
              <Megaphone size={18} className="text-[#00F0FF]" />
              <span className="text-[12.5px] font-bold text-white/90">광고 문의</span>
              <span className="text-[10px] leading-snug text-white/35">노출·상품</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInquiryKind('event');
                setInquiryOpen(true);
              }}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-left transition-all active:scale-[0.99]"
            >
              <PartyPopper size={18} className="text-[#FF6B6B]" />
              <span className="text-[12.5px] font-bold text-white/90">행사·제휴</span>
              <span className="text-[10px] leading-snug text-white/35">등록·협업</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInquiryKind('other');
                setInquiryOpen(true);
              }}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 text-left transition-all active:scale-[0.99]"
            >
              <Mail size={18} className="text-white/50" />
              <span className="text-[12.5px] font-bold text-white/90">기타 문의</span>
              <span className="text-[10px] leading-snug text-white/35">운영 전반</span>
            </button>
          </div>
        </Card>
        </div>

        <InquiryContactDialog open={inquiryOpen} onOpenChange={setInquiryOpen} initialKind={inquiryKind} />

        {(onLogout || onDeleteAccount) && (
          <div className="mt-10 flex flex-col gap-0 border-t border-white/[0.08] pt-6 pb-4">
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('로그아웃할까요?')) onLogout();
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] py-3 text-[12.5px] font-semibold text-white/45 transition-all active:scale-[0.99] hover:border-white/15 hover:bg-white/[0.04] hover:text-white/65 ${onDeleteAccount ? 'mb-2' : ''}`}
              >
                <LogOut size={16} className="opacity-70" />
                로그아웃
              </button>
            )}
            {onDeleteAccount && (
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => {
                  if (deletingAccount) return;
                  if (
                    !window.confirm(
                      '회원 탈퇴 시 스팟바이브에 저장된 프로필·설정이 삭제되고 로그아웃됩니다. 카카오 계정은 그대로 두고 앱 데이터만 지워요. 계속할까요?',
                    )
                  ) {
                    return;
                  }
                  if (!window.confirm('정말 탈퇴할까요? 이 작업은 되돌릴 수 없어요.')) return;
                  setDeletingAccount(true);
                  void (async () => {
                    try {
                      await onDeleteAccount();
                    } finally {
                      setDeletingAccount(false);
                    }
                  })();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] py-3 text-[12.5px] font-semibold text-red-300/90 transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserX size={16} className="opacity-90" />
                {deletingAccount ? '처리 중…' : '회원 탈퇴'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
