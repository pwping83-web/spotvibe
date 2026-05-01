import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, MapPinned, MessageCircle, Sparkles, Mail, Megaphone, PartyPopper, Lightbulb } from 'lucide-react';
import { InquiryContactDialog } from './InquiryContactDialog';
import type { InquiryKind } from '../constants/inquiry';

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
  { id: 'car_owner',            emoji: '🚗', title: '자차 보유',         sub: '차량 기준 경로·주차 안내',   accent: '#00F0FF' },
  { id: 'kickboard_license',    emoji: '🛴', title: '킥보드 면허 있음',   sub: '킥보드·PM 대여 우선 안내', accent: '#FFDE00' },
  { id: 'pedestrian_ddareungi', emoji: '🚶', title: '뚜벅이 · 따릉이',  sub: '도보·따릉이 위주 안내',     accent: '#FF6B6B' },
];

function MiniToggle({ on, accent, onToggle }: { on: boolean; accent: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

export type LocationMode = 'my_location' | 'explore';

const MBTI_LIST = [
  ['ENFP','ENFJ','ENTP','ENTJ'],
  ['ESFP','ESFJ','ESTP','ESTJ'],
  ['INFP','INFJ','INTP','INTJ'],
  ['ISFP','ISFJ','ISTP','ISTJ'],
] as const;

const MBTI_ACCENT: Record<string, string> = {
  E: '#FFDE00', I: '#00F0FF',
};

interface MyPageProps {
  mobilityProfile: MobilityProfile;
  onMobilityProfileChange: (v: MobilityProfile) => void;
  locationMode: LocationMode;
  onLocationModeChange: (mode: LocationMode) => void;
  mbtiSet: Set<string>;
  onMbtiSetChange: (v: Set<string>) => void;
  bloodType: Set<string>;
  onBloodTypeChange: (v: Set<string>) => void;
  genderPref: 'all' | 'female_crowd' | 'male_crowd';
  onGenderPrefChange: (v: 'all' | 'female_crowd' | 'male_crowd') => void;
  activityTags: Set<string>;
  onActivityTagsChange: (v: Set<string>) => void;
}

const AGE_RANGES = ['10대', '20대', '30대', '40대', '50대', '60대+'] as const;
const GENDERS = ['남성', '여성', '선택 안 함'] as const;

type AgeRange = typeof AGE_RANGES[number];
type Gender = typeof GENDERS[number];

export function MyPage({ mobilityProfile, onMobilityProfileChange, locationMode, onLocationModeChange, mbtiSet, onMbtiSetChange, bloodType, onBloodTypeChange, genderPref, onGenderPrefChange, activityTags, onActivityTagsChange }: MyPageProps) {
  const [weekdaySet, setWeekdaySet] = useState<Set<number>>(() => new Set([0, 2, 4]));
  const [timeSlotSet, setTimeSlotSet] = useState<Set<string>>(() => new Set(['evening']));
  const [aiPaused, setAiPaused] = useState(false);

  /** 카카오 초기값 — 사용자가 직접 수정 가능 */
  const [ageRange, setAgeRange] = useState<AgeRange>(MOCK_KAKAO_PROFILE.ageRangeLabel as AgeRange);
  const [gender, setGender] = useState<Gender>(MOCK_KAKAO_PROFILE.genderLabel as Gender);
  const [editingProfile, setEditingProfile] = useState(false);

  /** MBTI 질문 모드 */
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryKind, setInquiryKind] = useState<InquiryKind>('improvement');

  const [mbtiQuizMode, setMbtiQuizMode] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const quizDone = Object.keys(quizAnswers).length === 4;
  const derivedMbti = quizDone
    ? `${quizAnswers['EI']}${quizAnswers['SN']}${quizAnswers['TF']}${quizAnswers['JP']}`
    : null;

  const accent = ageRange === '20대' ? '#FFDE00'
    : ageRange === '30대' ? '#FF6B6B'
    : ageRange === '40대' ? '#00F0FF'
    : '#FF6B6B';
  const cyan = '#00F0FF';

  const toggleWeekday = (i: number) =>
    setWeekdaySet((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleTimeSlot = (id: string) =>
    setTimeSlotSet((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-white">카카오 연동</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: `${accent}18`, color: accent }}
                >
                  {ageRange} · {gender}
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/35">
                <MessageCircle size={10} />
                {editingProfile ? '아래에서 직접 수정할 수 있어요' : '카카오 값과 다르면 직접 수정하세요'}
              </p>
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
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setAgeRange(a)}
                            className="rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
                            style={{
                              borderColor: on ? `${accent}55` : 'rgba(255,255,255,0.1)',
                              backgroundColor: on ? `${accent}16` : 'transparent',
                              color: on ? accent : 'rgba(255,255,255,0.45)',
                            }}
                          >
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
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGender(g)}
                            className="flex-1 rounded-xl border py-2 text-[12px] font-semibold transition-all active:scale-95"
                            style={{
                              borderColor: on ? `${accent}55` : 'rgba(255,255,255,0.1)',
                              backgroundColor: on ? `${accent}16` : 'transparent',
                              color: on ? accent : 'rgba(255,255,255,0.45)',
                            }}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[10.5px] text-white/25">
                    ※ 수정한 정보는 AI 추천·집합 탐색에 반영되며, 카카오 계정에는 저장되지 않아요.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 이동 프로필 */}
        <SectionLabel>이동 방식</SectionLabel>
        <Card>
          <p className="mb-3 text-[11.5px] text-white/40">AI 경로·PM 안내에 반영됩니다.</p>
          <div className="flex flex-col gap-2">
            {MOBILITY_OPTIONS.map((opt) => {
              const on = mobilityProfile === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onMobilityProfileChange(opt.id)}
                  className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all active:scale-[0.99]"
                  style={{
                    borderColor: on ? `${opt.accent}40` : 'rgba(255,255,255,0.07)',
                    backgroundColor: on ? `${opt.accent}0e` : 'transparent',
                  }}
                >
                  <span className="text-xl leading-none">{opt.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold" style={{ color: on ? opt.accent : 'rgba(255,255,255,0.80)' }}>
                      {opt.title}
                    </p>
                    <p className="text-[11px] text-white/35">{opt.sub}</p>
                  </div>
                  <div
                    className="h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: on ? opt.accent : 'rgba(255,255,255,0.22)' }}
                  >
                    {on && <div className="h-2 w-2 rounded-full" style={{ backgroundColor: opt.accent }} />}
                  </div>
                </button>
              );
            })}
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
              const on = weekdaySet.has(i);
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
          <p className="mb-2.5 text-[11px] text-white/35">활동 시간대를 선택해 주세요.</p>
          <div className="flex flex-col gap-1.5">
            {TIME_SLOTS.map((slot) => {
              const on = timeSlotSet.has(slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => toggleTimeSlot(slot.id)}
                  className="flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all active:scale-[0.99]"
                  style={{
                    borderColor: on ? 'rgba(255,222,0,0.35)' : 'rgba(255,255,255,0.07)',
                    backgroundColor: on ? 'rgba(255,222,0,0.08)' : 'transparent',
                  }}
                >
                  <div>
                    <span className="text-[13px] font-semibold" style={{ color: on ? '#FFDE00' : 'rgba(255,255,255,0.65)' }}>
                      {slot.label}
                    </span>
                    <span className="ml-2 text-[11px] text-white/30">{slot.sub}</span>
                  </div>
                  <MiniToggle on={on} accent="#FFDE00" onToggle={() => toggleTimeSlot(slot.id)} />
                </button>
              );
            })}
          </div>
        </Card>

        {/* 성별 인파 + 활동 관심사 */}
        <SectionLabel>지도 인파 탐색 필터</SectionLabel>
        <Card>
          {/* 어떤 인파를 보고 싶은지 */}
          <p className="mb-2 text-[12px] font-semibold text-white/65">어떤 인파를 찾나요?</p>
          <div className="mb-4 flex gap-2">
            {([
              { key: 'all',          label: '전체',  emoji: '👥', accent: '#ffffff' },
              { key: 'female_crowd', label: '여성',  emoji: '👩', accent: '#FF6B6B' },
              { key: 'male_crowd',   label: '남성',  emoji: '👨', accent: '#00F0FF' },
            ] as const).map((opt) => {
              const on = genderPref === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onGenderPrefChange(opt.key)}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 transition-all active:scale-95"
                  style={{
                    borderColor: on ? `${opt.accent}50` : 'rgba(255,255,255,0.08)',
                    backgroundColor: on ? `${opt.accent}12` : 'transparent',
                  }}
                >
                  <span className="text-lg">{opt.emoji}</span>
                  <span className="text-[11px] font-semibold" style={{ color: on ? opt.accent : 'rgba(255,255,255,0.45)' }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 활동 관심사 태그 */}
          <p className="mb-2 text-[12px] font-semibold text-white/65">활동 관심사</p>
          <p className="mb-2.5 text-[11px] text-white/35">선택한 활동 구역이 지도에 집합으로 표시돼요.</p>
          <div className="flex flex-wrap gap-2">
            {[
              { tag: '운동',   emoji: '🏃', accent: '#00F0FF' },
              { tag: '수다',   emoji: '💬', accent: '#FF6B6B' },
              { tag: '산책',   emoji: '🌿', accent: '#4ADE80' },
              { tag: '야외',   emoji: '☀️', accent: '#FFDE00' },
              { tag: '소풍',   emoji: '🧺', accent: '#FB923C' },
              { tag: '공연',   emoji: '🎸', accent: '#FF6B6B' },
              { tag: '맛집',   emoji: '🍜', accent: '#FB923C' },
              { tag: '쇼핑',   emoji: '🛍️', accent: '#FFDE00' },
              { tag: '클럽',   emoji: '🎉', accent: '#A855F7' },
              { tag: '카페',   emoji: '☕', accent: '#D97706' },
              { tag: '전시',   emoji: '🖼️', accent: '#00F0FF' },
              { tag: '야경',   emoji: '🌃', accent: '#A855F7' },
            ].map(({ tag, emoji, accent }) => {
              const on = activityTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const next = new Set(activityTags);
                    on ? next.delete(tag) : next.add(tag);
                    onActivityTagsChange(next);
                  }}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
                  style={{
                    borderColor: on ? `${accent}55` : 'rgba(255,255,255,0.1)',
                    backgroundColor: on ? `${accent}16` : 'transparent',
                    color: on ? accent : 'rgba(255,255,255,0.45)',
                  }}
                >
                  <span>{emoji}</span>
                  {tag}
                </button>
              );
            })}
          </div>

          {activityTags.size > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-[11px] text-white/40"
            >
              📍 {Array.from(activityTags).join('·')} 구역이 지도에 표시됩니다.
            </motion.p>
          )}
        </Card>

        {/* MBTI 집합 탐색 */}
        <SectionLabel>MBTI 지도 집합 탐색</SectionLabel>
        <Card>
          <p className="mb-3 text-[11.5px] leading-relaxed text-white/40">
            선택한 MBTI 성향 구역과 교집합이 지도에 표시돼요. 복수 선택 가능.
          </p>

          {/* 상관없음 + 질문으로 찾기 */}
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => { onMbtiSetChange(new Set()); setMbtiQuizMode(false); setQuizAnswers({}); }}
              className="flex-1 rounded-xl border py-2 text-[12px] font-semibold transition-all active:scale-95"
              style={{
                borderColor: mbtiSet.size === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.1)',
                backgroundColor: mbtiSet.size === 0 ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: mbtiSet.size === 0 ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              전체 · 상관없음
            </button>
            <button
              type="button"
              onClick={() => { setMbtiQuizMode((v) => !v); setQuizAnswers({}); }}
              className="flex-1 rounded-xl border py-2 text-[12px] font-semibold transition-all active:scale-95"
              style={{
                borderColor: mbtiQuizMode ? 'rgba(0,240,255,0.5)' : 'rgba(255,255,255,0.1)',
                backgroundColor: mbtiQuizMode ? 'rgba(0,240,255,0.1)' : 'transparent',
                color: mbtiQuizMode ? '#00F0FF' : 'rgba(255,255,255,0.4)',
              }}
            >
              ✨ 질문으로 찾기
            </button>
          </div>

          {/* 질문 모드 */}
          <AnimatePresence>
            {mbtiQuizMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 overflow-hidden rounded-xl border border-[#00F0FF]/20 bg-[#00F0FF]/05 p-3"
              >
                {[
                  { axis: 'EI', q: '에너지 방향', a: [{ v: 'E', label: '외향 E', sub: '사람들과 어울릴 때 에너지 충전' }, { v: 'I', label: '내향 I', sub: '혼자 있을 때 에너지 충전' }] },
                  { axis: 'SN', q: '인식 방법',   a: [{ v: 'S', label: '감각 S', sub: '현실적·구체적인 것 선호' },       { v: 'N', label: '직관 N', sub: '가능성·아이디어에 관심' }] },
                  { axis: 'TF', q: '판단 기준',   a: [{ v: 'T', label: '사고 T', sub: '논리와 원칙 중시' },              { v: 'F', label: '감정 F', sub: '감정과 사람 먼저 생각' }] },
                  { axis: 'JP', q: '생활 방식',   a: [{ v: 'J', label: '계획 J', sub: '정리되고 계획적인 편' },          { v: 'P', label: '즉흥 P', sub: '유연하고 자유로운 편' }] },
                ].map(({ axis, q, a }) => (
                  <div key={axis} className="mb-3 last:mb-0">
                    <p className="mb-1.5 text-[11px] font-semibold text-white/55">{q}</p>
                    <div className="flex gap-1.5">
                      {a.map(({ v, label, sub }) => {
                        const on = quizAnswers[axis] === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setQuizAnswers((prev) => ({ ...prev, [axis]: v }))}
                            className="flex flex-1 flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-all active:scale-95"
                            style={{
                              borderColor: on ? 'rgba(0,240,255,0.55)' : 'rgba(255,255,255,0.08)',
                              backgroundColor: on ? 'rgba(0,240,255,0.14)' : 'rgba(255,255,255,0.02)',
                              color: on ? '#00F0FF' : 'rgba(255,255,255,0.55)',
                            }}
                          >
                            <span className="text-[12px] font-bold">{label}</span>
                            <span className="text-[10px] leading-snug opacity-70">{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {derivedMbti && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex items-center gap-2">
                    <span className="text-[12px] text-white/55">결과:</span>
                    <span className="text-[14px] font-black text-[#00F0FF]">{derivedMbti}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(mbtiSet);
                        next.add(derivedMbti);
                        onMbtiSetChange(next);
                        setMbtiQuizMode(false);
                        setQuizAnswers({});
                      }}
                      className="ml-auto rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/14 px-3 py-1 text-[11px] font-bold text-[#00F0FF]"
                    >
                      추가하기
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 16가지 직접 선택 */}
          <div className="flex flex-col gap-1.5">
            {MBTI_LIST.map((row, ri) => (
              <div key={ri} className="flex gap-1.5">
                {row.map((type) => {
                  const on = mbtiSet.has(type);
                  const acc = MBTI_ACCENT[type[0]] ?? '#FF6B6B';
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const next = new Set(mbtiSet);
                        on ? next.delete(type) : next.add(type);
                        onMbtiSetChange(next);
                      }}
                      className="flex-1 rounded-xl border py-2 text-[12px] font-bold transition-all active:scale-95"
                      style={{
                        borderColor: on ? `${acc}55` : 'rgba(255,255,255,0.08)',
                        backgroundColor: on ? `${acc}14` : 'transparent',
                        color: on ? acc : 'rgba(255,255,255,0.42)',
                      }}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {mbtiSet.size > 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-[11px] text-white/40">
              🗺️ {Array.from(mbtiSet).join(' · ')} 구역이 지도에 표시됩니다.
            </motion.p>
          )}
        </Card>

        {/* 혈액형 */}
        <SectionLabel>혈액형 (재미 요소)</SectionLabel>
        <Card>
          <p className="mb-3 text-[11.5px] text-white/40">
            혈액형 성격 기반 모임 구역을 가볍게 참고해 보세요 😄
          </p>
          <div className="flex gap-2">
            {/* 상관없음 */}
            <button
              type="button"
              onClick={() => onBloodTypeChange(new Set())}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-2.5 transition-all active:scale-95"
              style={{
                borderColor: bloodType.size === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)',
                backgroundColor: bloodType.size === 0 ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              <span className="text-[14px] font-black" style={{ color: bloodType.size === 0 ? '#fff' : 'rgba(255,255,255,0.35)' }}>
                전체
              </span>
            </button>
            {['A', 'B', 'O', 'AB'].map((bt) => {
              const on = bloodType.has(bt);
              const btAccent = bt === 'A' ? '#00F0FF' : bt === 'B' ? '#FFDE00' : bt === 'O' ? '#FF6B6B' : '#A855F7';
              return (
                <button
                  key={bt}
                  type="button"
                  onClick={() => {
                    const next = new Set(bloodType);
                    on ? next.delete(bt) : next.add(bt);
                    onBloodTypeChange(next);
                  }}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-2.5 transition-all active:scale-95"
                  style={{
                    borderColor: on ? `${btAccent}55` : 'rgba(255,255,255,0.08)',
                    backgroundColor: on ? `${btAccent}14` : 'transparent',
                  }}
                >
                  <span className="text-[14px] font-black" style={{ color: on ? btAccent : 'rgba(255,255,255,0.4)' }}>
                    {bt}형
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* AI 추천 */}
        <SectionLabel>AI 추천</SectionLabel>
        <Card>
          <div className="flex items-center gap-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-white/88">
                {aiPaused ? '💤 AI 추천 휴식 중' : '✨ AI 맞춤 추천 켜짐'}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/40">
                {aiPaused
                  ? '내일 다시 멋진 스팟을 찾아올게요.'
                  : '피드백·시간대·날씨까지 반영해 딱 맞는 곳을 골라드려요.'}
              </p>
            </div>
            <MiniToggle on={!aiPaused} accent="#00F0FF" onToggle={() => setAiPaused((v) => !v)} />
          </div>
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
                <p className="text-[11px] text-white/35">지도에서 원하는 지역 직접 선택</p>
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
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 rounded-xl border border-[#FFDE00]/20 bg-[#FFDE00]/06 px-3.5 py-2.5"
            >
              <p className="text-[11.5px] leading-relaxed text-[#FFDE00]/80">
                📍 지도 탭에서 원하는 위치를 탭하면 해당 지역의 핫스팟이 표시돼요.
              </p>
            </motion.div>
          )}
        </Card>

        {/* 운영 · 문의 (개선 제안 / 광고·행사) */}
        <SectionLabel>운영 · 문의</SectionLabel>
        <Card>
          <p className="mb-3 text-[11.5px] leading-relaxed text-white/42">
            서비스 개선 의견이나 광고·행사 문의를 보내 주세요. 메일 앱으로 초안이 열리며, 같은 기기에는 최근 접수 이력만 간단히 남습니다.
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

        <InquiryContactDialog open={inquiryOpen} onOpenChange={setInquiryOpen} initialKind={inquiryKind} />

        {/* 하단 메모 */}
        <div className="mt-8 flex items-center justify-center gap-1.5 pb-2 text-[10px] text-white/20">
          <Sparkles size={11} />
          <span>설정은 곧 Supabase에 동기화됩니다</span>
        </div>
      </div>
    </div>
  );
}
