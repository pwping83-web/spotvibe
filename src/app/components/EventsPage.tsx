import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Flame,
  Users,
  Sparkles,
  TrendingUp,
  Star,
  Clock,
  CheckCircle2,
  Camera,
  Trash2,
  Loader2,
  ShieldAlert,
  CalendarDays,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSpotReports, type SpotEvent, type SpotReportAgeFilter } from '@/hooks/useSpotReports';
import { useFeaturedSpotReports, type FeaturedSpotReport } from '@/hooks/useFeaturedSpotReports';
import { useMySpotReportLikes } from '@/hooks/useMySpotReportLikes';
import { usePublicNotices, type PublicNotice } from '@/hooks/usePublicNotices';
import { adminDeleteSpotReport } from '@/lib/adminDeleteSpotReport';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  addSpotReportLike,
  removeSpotReportLike,
  SPOT_REPORT_FEATURE_PROMOTION_LIKES,
} from '@/lib/spotReportLikes';
import { FaceMosaicImage } from './FaceMosaicImage';
import { SpotReportLikeChip } from './SpotReportLikeChip';
import { useAuth } from '@/app/App';

/** App·Edge `admin-delete-spot-report` 와 동일 이메일 */
const SPOTVIBE_ADMIN_EMAIL = 'pwping83@gmail.com';

type FilterKey = SpotReportAgeFilter;

const FILTERS: { key: FilterKey; label: string; accent: string }[] = [
  { key: 'all', label: '전체', accent: '#ffffff' },
  { key: '20s', label: '20대', accent: '#FFDE00' },
  { key: '30s', label: '30대', accent: '#FF6B6B' },
  { key: '40s', label: '40대+', accent: '#00F0FF' },
];

const MOCK_EVENTS = [
  { id: 1, title: '홍대 버스킹 페스티벌', category: '버스킹', distance: '0.3km', accent: '#FFDE00', ageGroup: '20s', emoji: '🎸', crowd: '110명 활성', isHot: true, isSponsored: false, trend: '+24%' },
  { id: 2, title: '연남동 플리마켓 타임세일', category: '플리마켓', distance: '0.8km', accent: '#FFDE00', ageGroup: '20s', emoji: '🛍️', crowd: '95명 집결', isHot: false, isSponsored: true, trend: '+12%' },
  { id: 3, title: '여의도 한강 무료 에어로빅', category: '피트니스', distance: '2.1km', accent: '#00F0FF', ageGroup: '40s', emoji: '🏃', crowd: '152명 운동 중', isHot: true, isSponsored: false, trend: '+41%' },
  { id: 4, title: '성수동 브랜드 팝업 스토어', category: '팝업', distance: '3.1km', accent: '#FFDE00', ageGroup: '20s', emoji: '🏪', crowd: '200명 방문', isHot: true, isSponsored: true, trend: '+88%' },
  { id: 5, title: '망원 한강 야간 러닝 크루', category: '러닝', distance: '4.0km', accent: '#FF6B6B', ageGroup: '30s', emoji: '🌙', crowd: '35명 집결', isHot: false, isSponsored: false, trend: '+5%' },
  { id: 6, title: '강남 루프탑 바 싱글 모임', category: '바·라운지', distance: '5.2km', accent: '#FF6B6B', ageGroup: '30s', emoji: '🍹', crowd: '120명 대기', isHot: true, isSponsored: true, trend: '+67%' },
  { id: 7, title: '인사동 도예 원데이 클래스', category: '클래스', distance: '6.4km', accent: '#00F0FF', ageGroup: '40s', emoji: '🏺', crowd: '22명 · 잔여 3석', isHot: false, isSponsored: false, trend: '+3%' },
  { id: 8, title: '이태원 글로벌 푸드 페스타', category: '푸드', distance: '7.1km', accent: '#FFDE00', ageGroup: '20s', emoji: '🍜', crowd: '230명 현장', isHot: true, isSponsored: false, trend: '+55%' },
];

const CATEGORY_EMOJI: Record<string, string> = {
  performance: '🎤',
  market: '🛒',
  crowd: '👥',
  other: '📍',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  return `${Math.floor(mins / 60)}시간 전`;
}

function spotClusterArmKey(event: SpotEvent): string {
  return event.reportIds[0] ?? `${event.lat}-${event.lng}-${event.latestAt}`;
}

function FeaturedSpotCard({
  row,
  liked,
  likeBusy,
  userId,
  likeEnabled,
  onToggleLike,
}: {
  row: FeaturedSpotReport;
  liked: boolean;
  likeBusy: boolean;
  userId: string | null;
  likeEnabled: boolean;
  onToggleLike: (reportId: string) => void;
}) {
  const title = row.place_name?.trim() || row.ai_label?.trim() || '현장 제보';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2.5 overflow-hidden rounded-2xl border border-orange-400/35 bg-gradient-to-b from-orange-500/10 to-transparent"
    >
      <div className="relative h-28 overflow-hidden">
        <FaceMosaicImage
          src={row.photo_url}
          alt={title}
          className="relative h-full w-full"
          imgClassName="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
          <Flame size={11} className="text-orange-400" fill="currentColor" />
          <span className="text-[10px] font-bold text-orange-100">핫 픽</span>
        </div>
        {likeEnabled && (
          <div className="absolute bottom-2 right-2 z-10">
            <SpotReportLikeChip
              compact
              count={row.like_count}
              liked={liked}
              busy={likeBusy}
              disabled={!userId}
              onClick={() => onToggleLike(row.id)}
            />
          </div>
        )}
      </div>
      <div className="px-3 pb-3 pt-2">
        <p className="truncate text-[14px] font-semibold text-white/90">{title}</p>
        <p className="mt-1 text-[10px] leading-snug text-white/38">
          타인 좋아요 {SPOT_REPORT_FEATURE_PROMOTION_LIKES}개 이상 ·{' '}
          <span className="text-white/50">{relativeTime(row.featured_in_events_at)}</span> 이벤트 픽 등록
        </p>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// 공공 공지 카테고리 메타
// ──────────────────────────────────────────────
const NOTICE_META: Record<string, { emoji: string; color: string; label: string }> = {
  fire:       { emoji: '🔥', color: '#FF6B6B', label: '화재' },
  flood:      { emoji: '🌊', color: '#60A5FA', label: '홍수·태풍' },
  earthquake: { emoji: '🌍', color: '#F59E0B', label: '지진' },
  safety:     { emoji: '⚠️', color: '#FBBF24', label: '안전' },
  event:      { emoji: '🎪', color: '#A78BFA', label: '지역행사' },
  general:    { emoji: '📢', color: '#94A3B8', label: '공지' },
};

function noticeAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

function PublicNoticeCard({ notice }: { notice: PublicNotice }) {
  const meta = NOTICE_META[notice.category] ?? NOTICE_META.general;
  const isDisaster = notice.source === 'disaster_sms';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2 overflow-hidden rounded-2xl border"
      style={{
        borderColor: isDisaster ? 'rgba(251,191,36,0.30)' : 'rgba(167,139,250,0.20)',
        backgroundColor: isDisaster ? 'rgba(251,191,36,0.05)' : 'rgba(167,139,250,0.04)',
      }}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px]"
          style={{ backgroundColor: `${meta.color}16` }}
        >
          {meta.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
            {isDisaster && (
              <span className="flex items-center gap-0.5 rounded-md bg-yellow-400/15 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300">
                <ShieldAlert size={9} />
                재난문자
              </span>
            )}
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color: meta.color, backgroundColor: `${meta.color}14` }}
            >
              {meta.label}
            </span>
            {notice.region_name && (
              <span className="flex items-center gap-0.5 truncate text-[10px] text-white/30">
                <MapPin size={8} />
                {notice.region_name.slice(0, 18)}
              </span>
            )}
            <span className="ml-auto shrink-0 flex items-center gap-0.5 text-[10px] text-white/28">
              <Clock size={8} />
              {noticeAge(notice.issued_at)}
            </span>
          </div>

          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white/88">
            {notice.title}
          </p>

          {notice.body && notice.body !== notice.title && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/40">
              {notice.body}
            </p>
          )}

          {notice.external_url && (
            <a
              href={notice.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/04 px-2.5 py-1 text-[10.5px] text-white/50 transition-colors hover:text-white/80 active:scale-95"
            >
              <ExternalLink size={9} />
              원문 보기
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SpotEventCard({
  event,
  idx,
  isAdmin,
  adminArmKey,
  adminDeleteBusy,
  onAdminDeleteTap,
  userId,
  likeEnabled,
  likedPrimary,
  likeBusy,
  onToggleLike,
}: {
  event: SpotEvent;
  idx: number;
  isAdmin: boolean;
  adminArmKey: string | null;
  adminDeleteBusy: boolean;
  onAdminDeleteTap: (event: SpotEvent) => void;
  userId: string | null;
  likeEnabled: boolean;
  likedPrimary: boolean;
  likeBusy: boolean;
  onToggleLike: (reportId: string) => void;
}) {
  const emoji = CATEGORY_EMOJI[event.category] ?? '📍';
  const accent = event.isConfirmed ? '#4ADE80' : '#A855F7';
  const armKey = spotClusterArmKey(event);
  const deleteArmed = adminArmKey === armKey;
  const pid = event.primaryReportId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: idx * 0.04 }}
      className="relative mb-2.5 overflow-hidden rounded-2xl border"
      style={{
        borderColor: event.isConfirmed ? 'rgba(74,222,128,0.25)' : 'rgba(168,85,247,0.2)',
        backgroundColor: event.isConfirmed ? 'rgba(74,222,128,0.04)' : 'rgba(168,85,247,0.04)',
      }}
    >
      {isAdmin && (
        <div className="absolute right-2 top-2 z-20 flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={adminDeleteBusy}
            onClick={() => onAdminDeleteTap(event)}
            className="flex items-center gap-1 rounded-lg border border-amber-500/35 bg-black/55 px-2 py-1 text-[10px] font-bold text-amber-200 backdrop-blur-sm active:scale-[0.97] disabled:opacity-40"
            title={deleteArmed ? '이 카드의 제보를 DB·원본에서 삭제' : '한 번 더 누르면 삭제'}
          >
            {adminDeleteBusy && deleteArmed ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            {deleteArmed ? '삭제 실행' : '관리자 삭제'}
          </button>
          {deleteArmed && !adminDeleteBusy && (
            <span className="max-w-[9.5rem] rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] text-amber-100/90">
              다시 누르면 이 묶음 {event.reportIds.length}건 삭제
            </span>
          )}
        </div>
      )}

      {event.photoUrls.length > 0 && (
        <div className="relative h-32 overflow-hidden">
          <FaceMosaicImage
            src={event.photoUrls[0]}
            alt={event.label}
            className="relative h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
          {event.photoUrls.length > 1 && (
            <div className="absolute right-2 top-2 z-[1] flex gap-1">
              {event.photoUrls.map((_, i) => (
                <span
                  key={i}
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: i === 0 ? '#fff' : 'rgba(255,255,255,0.45)' }}
                />
              ))}
            </div>
          )}
          {event.isConfirmed && (
            <div className="absolute left-2 top-2 z-[1] flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
              <CheckCircle2 size={11} color="#4ADE80" />
              <span className="text-[10px] font-bold text-[#4ADE80]">확인됨</span>
            </div>
          )}
          {likeEnabled && pid && (
            <div className="absolute bottom-2 right-2 z-10">
              <SpotReportLikeChip
                compact
                count={event.likeTotal}
                liked={likedPrimary}
                busy={likeBusy}
                disabled={!userId}
                onClick={() => onToggleLike(pid)}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 p-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[20px]"
          style={{ backgroundColor: `${accent}14` }}
        >
          {emoji}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{ color: accent, backgroundColor: `${accent}18` }}
            >
              {event.isConfirmed ? '실시간 확인' : '제보 접수'}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-white/30">
              <Clock size={9} />
              {relativeTime(event.latestAt)}
            </span>
          </div>

          <p className="truncate text-[14px] font-semibold text-white/90">{event.label}</p>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="flex items-center gap-0.5 text-[10.5px]" style={{ color: `${accent}bb` }}>
                <Camera size={9} />
                {event.reportCount}명 제보
              </span>
              <span className="flex items-center gap-0.5 text-[10.5px] text-white/30">
                <MapPin size={9} />
                {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
              </span>
            </div>
            {likeEnabled && pid && event.photoUrls.length === 0 && (
              <SpotReportLikeChip
                count={event.likeTotal}
                liked={likedPrimary}
                busy={likeBusy}
                disabled={!userId}
                onClick={() => onToggleLike(pid)}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function EventsPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const { userEmail, userId } = useAuth();
  const isAdmin = userEmail === SPOTVIBE_ADMIN_EMAIL;
  const [adminArmKey, setAdminArmKey] = useState<string | null>(null);
  const [adminDeleteBusy, setAdminDeleteBusy] = useState(false);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);

  const supabaseOk = isSupabaseConfigured();
  const { events: spotEvents, refetch: refetchSpotReports } = useSpotReports(supabaseOk, filter);
  const { rows: featuredRows, refetch: refetchFeatured } = useFeaturedSpotReports(supabaseOk, filter);
  const { notices: publicNotices } = usePublicNotices(supabaseOk);

  const reportIdsForLikes = useMemo(() => {
    const s = new Set<string>();
    featuredRows.forEach((r) => s.add(r.id));
    spotEvents.forEach((e) => {
      if (e.primaryReportId) s.add(e.primaryReportId);
    });
    return [...s];
  }, [featuredRows, spotEvents]);

  const { likedSet, refresh: refreshLikes } = useMySpotReportLikes(supabaseOk && !!userId, userId, reportIdsForLikes);

  const handleToggleLike = useCallback(
    async (reportId: string) => {
      if (!userId) {
        toast.message('로그인이 필요해요', { description: '로그인한 뒤 좋아요를 눌러 주세요.' });
        return;
      }
      const sb = getSupabase();
      if (!sb) return;
      const liked = likedSet.has(reportId);
      setLikeBusyId(reportId);
      try {
        if (liked) {
          const r = await removeSpotReportLike(sb, reportId, userId);
          if (!r.ok) {
            toast.error('좋아요 취소에 실패했어요.', { description: r.error });
            return;
          }
        } else {
          const r = await addSpotReportLike(sb, reportId, userId);
          if (!r.ok) {
            toast.error('좋아요에 실패했어요.', {
              description: r.error ?? '본인 제보에는 좋아요를 누를 수 없어요.',
            });
            return;
          }
        }
        refreshLikes();
        refetchSpotReports();
        refetchFeatured();
      } finally {
        setLikeBusyId(null);
      }
    },
    [userId, likedSet, refreshLikes, refetchSpotReports, refetchFeatured],
  );

  const handleAdminDeleteTap = useCallback(
    (event: SpotEvent) => {
      const key = spotClusterArmKey(event);
      if (!event.reportIds.length) return;
      if (adminArmKey !== key) {
        setAdminArmKey(key);
        return;
      }

      void (async () => {
        const sb = getSupabase();
        if (!sb) {
          toast.error('연결 설정을 확인해 주세요.');
          return;
        }
        setAdminDeleteBusy(true);
        try {
          for (const reportId of event.reportIds) {
            const result = await adminDeleteSpotReport(sb, reportId);
            if (!result.ok) {
              console.error('adminDeleteSpotReport:', result.message);
              toast.error('삭제에 실패했어요.', { description: result.message });
              return;
            }
          }
          toast.success('제보를 삭제했어요.', {
            description:
              event.reportIds.length > 1 ? `${event.reportIds.length}건 · Storage 원본 포함` : 'Storage 원본 포함',
          });
          setAdminArmKey(null);
          refetchSpotReports();
          refetchFeatured();
          refreshLikes();
        } finally {
          setAdminDeleteBusy(false);
        }
      })();
    },
    [adminArmKey, refetchSpotReports, refetchFeatured, refreshLikes],
  );

  const filteredMock =
    filter === 'all' ? MOCK_EVENTS : MOCK_EVENTS.filter((e) => e.ageGroup === filter);

  const totalCount = featuredRows.length + spotEvents.length + filteredMock.length + publicNotices.length;
  const hasLiveBlocks = featuredRows.length > 0 || spotEvents.length > 0;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#0A0A0E]">
      <div className="shrink-0 px-5 pb-3 pt-[4.5rem]">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-white">지금 뜨는 핫스팟</h2>
            <p className="mt-0.5 text-[12.5px] text-white/40">내 주변 오프라인 이벤트 실시간 집계</p>
            <p className="mt-1 text-[10px] leading-snug text-white/28">
              타인 좋아요 {SPOT_REPORT_FEATURE_PROMOTION_LIKES}개 이상이면「핫 픽」으로 올라와요. 본인 제보에는 좋아요를
              누를 수 없어요.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 rounded-full border border-[#FFDE00]/25 bg-[#FFDE00]/08 px-2.5 py-1">
              <TrendingUp size={11} className="text-[#FFDE00]" />
              <span className="text-[11px] font-semibold text-[#FFDE00]">{totalCount}개</span>
            </div>
            {featuredRows.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-orange-300/90">
                <Flame size={9} className="shrink-0" fill="currentColor" />
                핫 픽 {featuredRows.length}건
              </span>
            )}
            {spotEvents.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#4ADE80]">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ADE80]" />
                실시간 {spotEvents.length}건
              </span>
            )}
            {publicNotices.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-yellow-300/80">
                <ShieldAlert size={9} className="shrink-0" />
                공지 {publicNotices.length}건
              </span>
            )}
          </div>
        </div>

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

      <div className="flex-1 overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none' }}>
        {/* ── 공공 안전·공지 섹션 (재난문자 우선, 그 아래 지역행사) ── */}
        {publicNotices.length > 0 && (
          <>
            {/* 재난문자 */}
            {publicNotices.filter((n) => n.source === 'disaster_sms').length > 0 && (
              <>
                <div className="mb-2 mt-1 flex items-center gap-2">
                  <ShieldAlert size={12} className="text-yellow-400" />
                  <p className="text-[11.5px] font-semibold text-yellow-300">재난·안전 공지</p>
                  <span className="text-[10.5px] text-white/30">공공데이터 자동 수집</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {publicNotices
                    .filter((n) => n.source === 'disaster_sms')
                    .map((notice) => (
                      <PublicNoticeCard key={notice.id} notice={notice} />
                    ))}
                </AnimatePresence>
              </>
            )}

            {/* 지역 행사·공원 공지 */}
            {publicNotices.filter((n) => n.source !== 'disaster_sms').length > 0 && (
              <>
                <div className="mb-2 mt-3 flex items-center gap-2">
                  <CalendarDays size={12} className="text-violet-400" />
                  <p className="text-[11.5px] font-semibold text-violet-300">지역 행사·공원 공지</p>
                  <span className="text-[10.5px] text-white/30">공공데이터 자동 수집</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {publicNotices
                    .filter((n) => n.source !== 'disaster_sms')
                    .map((notice) => (
                      <PublicNoticeCard key={notice.id} notice={notice} />
                    ))}
                </AnimatePresence>
              </>
            )}

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/08" />
              <span className="text-[10.5px] text-white/28">시민 제보</span>
              <div className="h-px flex-1 bg-white/08" />
            </div>
          </>
        )}

        {featuredRows.length > 0 && (
          <>
            <div className="mb-2 mt-1 flex items-center gap-2">
              <Flame size={12} className="text-orange-400" fill="currentColor" />
              <p className="text-[11.5px] font-semibold text-orange-200">핫 픽 · 이벤트</p>
              <span className="text-[10.5px] text-white/30">좋아요 {SPOT_REPORT_FEATURE_PROMOTION_LIKES}+</span>
            </div>
            <AnimatePresence mode="popLayout">
              {featuredRows.map((row) => (
                <FeaturedSpotCard
                  key={row.id}
                  row={row}
                  liked={likedSet.has(row.id)}
                  likeBusy={likeBusyId === row.id}
                  userId={userId}
                  likeEnabled={supabaseOk}
                  onToggleLike={handleToggleLike}
                />
              ))}
            </AnimatePresence>
          </>
        )}

        {spotEvents.length > 0 && (
          <>
            <div className="mb-2 mt-1 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ADE80]" />
              <p className="text-[11.5px] font-semibold text-[#4ADE80]">실시간 제보</p>
              <span className="text-[10.5px] text-white/30">최근 2시간 내</span>
            </div>
            <AnimatePresence mode="popLayout">
              {spotEvents.map((event, idx) => (
                <SpotEventCard
                  key={event.reportIds.join('-')}
                  event={event}
                  idx={idx}
                  isAdmin={isAdmin}
                  adminArmKey={adminArmKey}
                  adminDeleteBusy={adminDeleteBusy}
                  onAdminDeleteTap={handleAdminDeleteTap}
                  userId={userId}
                  likeEnabled={supabaseOk}
                  likedPrimary={likedSet.has(event.primaryReportId)}
                  likeBusy={likeBusyId === event.primaryReportId}
                  onToggleLike={handleToggleLike}
                />
              ))}
            </AnimatePresence>
          </>
        )}

        {hasLiveBlocks && filteredMock.length > 0 && (
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/08" />
            <span className="text-[10.5px] text-white/30">추천 이벤트</span>
            <div className="h-px flex-1 bg-white/08" />
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {filteredMock.map((e, idx) => (
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
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[22px]"
                style={{ backgroundColor: `${e.accent}12` }}
              >
                {e.emoji}
              </div>
              <div className="min-w-0 flex-1">
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
                      <Flame size={9} fill="currentColor" />
                      핫
                    </span>
                  )}
                  {e.isSponsored ? (
                    <span className="ml-auto flex items-center gap-0.5 text-[9.5px] font-semibold text-white/30">
                      <Star size={8} className="text-white/25" />
                      광고
                    </span>
                  ) : (
                    <span className="ml-auto text-[10px] font-bold" style={{ color: e.accent }}>
                      {e.trend}
                    </span>
                  )}
                </div>
                <p className="truncate text-[14.5px] font-semibold text-white/90">{e.title}</p>
                <div className="mt-1 flex items-center gap-1">
                  <Users size={10} style={{ color: e.accent }} />
                  <span className="text-[11px]" style={{ color: `${e.accent}cc` }}>
                    {e.crowd}
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {totalCount === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Sparkles size={28} className="text-white/15" />
            <p className="text-center text-[13px] text-white/35">
              이벤트가 없어요.
              <br />
              필터를 바꾸거나 직접 제보해주세요.
            </p>
          </div>
        )}

        <p className="mt-4 pb-2 text-center text-[10.5px] leading-relaxed text-white/28">
          행사 등록·광고 문의는 <span className="text-white/45">마이</span> 탭의「운영 · 문의」에서 메일로 보내 주세요.
        </p>
      </div>
    </div>
  );
}
