import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Flag, Images, Shield, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/App';
import { useMySpotReportLikes } from '@/hooks/useMySpotReportLikes';
import { usePhotoCommunity, type CommunityPhoto } from '@/hooks/usePhotoCommunity';
import { addSpotReportLike, removeSpotReportLike } from '@/lib/spotReportLikes';
import { adminDeleteSpotReport } from '@/lib/adminDeleteSpotReport';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { PHOTO_GALLERY_TABS, type GalleryCategoryKey } from '@/lib/photoCategories';
import { FaceMosaicImage } from './FaceMosaicImage';
import { SpotReportLikeChip } from './SpotReportLikeChip';

const FLAG_HIDE_THRESHOLD = 20;

const ABUSE_CATS = [
  { id: 'promo_spam' as const, label: '홍보·스팸' },
  { id: 'sexual' as const, label: '음란' },
  { id: 'crime_related' as const, label: '범죄·불법' },
  { id: 'other' as const, label: '기타' },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

function CategoryLabel({ catKey }: { catKey: string | null }) {
  const cat = PHOTO_GALLERY_TABS.find((c) => c.key === catKey);
  if (!cat || cat.key === 'all') return null;
  return (
    <span
      className="absolute left-2 top-2 z-[2] flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
      style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.80)' }}
    >
      <span className="text-[9px] leading-none">{cat.emoji}</span>
      {cat.label}
    </span>
  );
}

function GalleryPhotoTile({
  item,
  onOpen,
  liked,
  likeBusy,
  onToggleLike,
  userId,
}: {
  item: CommunityPhoto;
  onOpen: (item: CommunityPhoto) => void;
  liked: boolean;
  likeBusy: boolean;
  onToggleLike: (id: string) => void;
  userId: string | null;
}) {
  const own = !!(userId && item.user_id && userId === item.user_id);
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40" style={{ aspectRatio: '3/4' }}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="absolute inset-0 z-0 outline-none"
        aria-label="사진 크게 보기"
      >
        <FaceMosaicImage
          src={item.photo_url}
          alt={item.ai_label ?? '현장 제보'}
          className="h-full w-full"
          imgClassName="h-full w-full object-cover"
        />
      </button>
      {/* 카테고리 배지 */}
      <CategoryLabel catKey={item.user_category} />
      {/* 그라데이션 + 텍스트 */}
      <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col justify-end">
        <div className="flex-1 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="shrink-0 px-2.5 pb-2 pt-5">
          <p className="truncate text-[11px] font-bold text-white">
            {item.place_name ?? item.ai_label ?? '현장 제보'}
          </p>
          <p className="mt-0.5 text-[9.5px] text-white/45">{relativeTime(item.created_at)}</p>
        </div>
      </div>
      {/* 좋아요 */}
      <div className="absolute right-1.5 top-1.5 z-[2]">
        <SpotReportLikeChip
          compact
          count={item.like_count}
          liked={liked}
          disabled={!userId || own}
          busy={likeBusy}
          onClick={() => onToggleLike(item.id)}
        />
      </div>
    </div>
  );
}

export interface PhotoGallerySheetProps {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onModeration?: () => void;
}

export function PhotoGallerySheet({
  open,
  onClose,
  isAdmin = false,
  onModeration,
}: PhotoGallerySheetProps) {
  const { userId } = useAuth();
  const [activeCategory, setActiveCategory] = useState<GalleryCategoryKey>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const { photos, loading } = usePhotoCommunity(activeCategory, open, refreshKey);

  const [lightbox, setLightbox] = useState<CommunityPhoto | null>(null);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);
  const [flagBusy, setFlagBusy] = useState(false);
  const [abuseBusy, setAbuseBusy] = useState(false);
  const [adminDeleteBusy, setAdminDeleteBusy] = useState(false);
  const [adminDeleteConfirm, setAdminDeleteConfirm] = useState(false);
  const [showAbuseMenu, setShowAbuseMenu] = useState(false);

  useEffect(() => {
    if (!open) {
      setLightbox(null);
      setShowAbuseMenu(false);
    }
  }, [open]);

  useEffect(() => {
    setAdminDeleteConfirm(false);
    setShowAbuseMenu(false);
  }, [lightbox?.id]);

  const supabaseOk = isSupabaseConfigured();
  const reportIdsForLikes = useMemo(() => photos.map((p) => p.id), [photos]);
  const { likedSet, refresh: refreshLikes } = useMySpotReportLikes(
    supabaseOk && open && !!userId,
    userId,
    reportIdsForLikes,
  );

  const lightboxLive = useMemo(
    () => (lightbox ? (photos.find((p) => p.id === lightbox.id) ?? lightbox) : null),
    [lightbox, photos],
  );

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
          if (!r.ok) { toast.error('좋아요 취소에 실패했어요.', { description: r.error }); return; }
        } else {
          const r = await addSpotReportLike(sb, reportId, userId);
          if (!r.ok) {
            toast.error('좋아요에 실패했어요.', { description: r.error ?? '본인 제보에는 좋아요를 누를 수 없어요.' });
            return;
          }
        }
        refreshLikes();
        setRefreshKey((k) => k + 1);
      } finally {
        setLikeBusyId(null);
      }
    },
    [userId, likedSet, refreshLikes],
  );

  const handleFlagReport = useCallback(async () => {
    if (!lightbox || flagBusy) return;
    if (!userId) { toast.error('로그인 후 신고할 수 있어요.'); return; }
    const sb = getSupabase();
    if (!sb) { toast.error('연결 설정을 확인해 주세요.'); return; }
    setFlagBusy(true);
    try {
      const { data, error } = await sb.rpc('flag_spot_report', { p_report_id: lightbox.id });
      if (error) { toast.error('신고 처리에 실패했어요.', { description: error.message }); return; }
      const row = data as { ok?: boolean; error?: string; count?: number; new_flag?: boolean; auto_hidden?: boolean };
      if (!row?.ok) {
        if (row.error === 'own_report') toast.error('본인이 올린 제보는 신고할 수 없어요.');
        else if (row.error === 'not_flaggable') toast.error('이미 내려간 제보라 신고할 수 없어요.');
        else toast.error('신고할 수 없어요.');
        return;
      }
      const cnt = typeof row.count === 'number' ? row.count : 0;
      if (!row.new_flag) { toast.message('이미 신고한 제보예요', { description: `${cnt}/${FLAG_HIDE_THRESHOLD}명` }); return; }
      toast.success('신고가 접수됐어요', { description: `${cnt}/${FLAG_HIDE_THRESHOLD}명 · ${FLAG_HIDE_THRESHOLD}명이면 피드에서 내려가요` });
      if (row.auto_hidden) { toast.message('다수 신고로 피드에서 내려갔어요'); setLightbox(null); }
      setRefreshKey((k) => k + 1);
    } finally {
      setFlagBusy(false);
    }
  }, [lightbox, flagBusy, userId]);

  const handleContentAbuse = useCallback(
    async (cat: (typeof ABUSE_CATS)[number]['id']) => {
      if (!lightboxLive || abuseBusy) return;
      if (!userId) { toast.error('로그인 후 신고할 수 있어요.'); return; }
      if (lightboxLive.user_id && userId === lightboxLive.user_id) { toast.error('본인 제보는 신고할 수 없어요.'); return; }
      const sb = getSupabase();
      if (!sb) { toast.error('연결 설정을 확인해 주세요.'); return; }
      setAbuseBusy(true);
      try {
        const { data, error } = await sb.rpc('submit_content_abuse_report', {
          p_content_type: 'spot_report', p_content_id: lightboxLive.id, p_category: cat, p_detail: null,
        });
        if (error) { toast.error('유형 신고에 실패했어요.', { description: error.message }); return; }
        const row = data as { ok?: boolean; error?: string };
        if (!row?.ok) { toast.error('신고할 수 없어요.', { description: row?.error ?? '' }); return; }
        toast.success('유형 신고가 접수됐어요.');
        setShowAbuseMenu(false);
      } finally {
        setAbuseBusy(false);
      }
    },
    [lightboxLive, abuseBusy, userId],
  );

  const handleAdminDelete = useCallback(async () => {
    if (!lightbox || adminDeleteBusy) return;
    const sb = getSupabase();
    if (!sb) { toast.error('연결 설정을 확인해 주세요.'); return; }
    setAdminDeleteBusy(true);
    try {
      const result = await adminDeleteSpotReport(sb, lightbox.id);
      if (!result.ok) { toast.error('삭제에 실패했어요.', { description: result.message }); return; }
      toast.success('제보와 원본 파일을 삭제했어요.');
      setLightbox(null);
      setAdminDeleteConfirm(false);
      setRefreshKey((k) => k + 1);
      onModeration?.();
    } finally {
      setAdminDeleteBusy(false);
    }
  }, [lightbox, adminDeleteBusy, onModeration]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 배경 딤 */}
          <motion.div
            key="gallery-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[460] bg-black/70"
            onClick={onClose}
          />

          {/* 시트 본체 */}
          <motion.div
            key="gallery-sheet"
            role="dialog"
            aria-modal
            aria-label="커뮤니티 사진 갤러리"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[470] flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#0e0e18]"
            style={{ maxHeight: 'calc(100dvh - 3.5rem)', paddingBottom: 'calc(5.5rem)' }}
          >
            {/* 헤더 */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/08 px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-bold text-white">
                  <Images size={16} color="#C084FC" strokeWidth={2.3} />
                  커뮤니티 사진
                </h2>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/38">
                  <Shield size={11} className="text-[#00F0FF]/70" />
                  최근 7일 · 전체 지역
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/08 text-white/60"
                aria-label="갤러리 닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* 카테고리 탭 */}
            <div
              ref={tabBarRef}
              className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/06 px-4 py-2.5 scrollbar-none"
              style={{ scrollbarWidth: 'none' }}
            >
              {PHOTO_GALLERY_TABS.map((tab) => {
                const active = activeCategory === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCategory(tab.key as GalleryCategoryKey)}
                    className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors"
                    style={{
                      background: active ? 'rgba(192,132,252,0.18)' : 'rgba(255,255,255,0.05)',
                      border: active ? '1px solid rgba(192,132,252,0.55)' : '1px solid rgba(255,255,255,0.09)',
                      color: active ? '#C084FC' : 'rgba(255,255,255,0.50)',
                    }}
                  >
                    <span className="text-[13px] leading-none">{tab.emoji}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* 사진 그리드 */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading && (
                <div className="flex h-40 items-center justify-center">
                  <span className="text-[13px] text-white/35">불러오는 중…</span>
                </div>
              )}
              {!loading && photos.length === 0 && (
                <div className="flex h-40 flex-col items-center justify-center gap-2">
                  <span className="text-[28px]">📭</span>
                  <p className="text-[13px] text-white/35">
                    {activeCategory === 'all' ? '아직 올라온 사진이 없어요' : '이 카테고리에 사진이 없어요'}
                  </p>
                  <p className="text-[11px] text-white/25">현장 제보를 올리면 여기 표시돼요</p>
                </div>
              )}
              {!loading && photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 p-3">
                  {photos.map((photo) => (
                    <GalleryPhotoTile
                      key={photo.id}
                      item={photo}
                      onOpen={setLightbox}
                      liked={likedSet.has(photo.id)}
                      likeBusy={likeBusyId === photo.id}
                      onToggleLike={handleToggleLike}
                      userId={userId}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* 라이트박스 */}
          <AnimatePresence>
            {lightboxLive && (
              <motion.div
                key="gallery-lightbox"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[490] flex flex-col bg-black/92"
                onClick={() => { setLightbox(null); setShowAbuseMenu(false); }}
              >
                {/* 상단 툴바 */}
                <div
                  className="flex shrink-0 items-center justify-between px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-[14px] font-bold text-white">
                      {lightboxLive.place_name ?? lightboxLive.ai_label ?? '현장 제보'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/40">{relativeTime(lightboxLive.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SpotReportLikeChip
                      compact={false}
                      count={lightboxLive.like_count}
                      liked={likedSet.has(lightboxLive.id)}
                      disabled={!userId || !!(lightboxLive.user_id && userId === lightboxLive.user_id)}
                      busy={likeBusyId === lightboxLive.id}
                      onClick={() => handleToggleLike(lightboxLive.id)}
                    />
                    <button
                      type="button"
                      onClick={() => { setLightbox(null); setShowAbuseMenu(false); }}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70"
                      aria-label="닫기"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* 사진 */}
                <div className="relative min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
                  <FaceMosaicImage
                    src={lightboxLive.photo_url}
                    alt={lightboxLive.ai_label ?? '현장 제보'}
                    className="h-full w-full"
                    imgClassName="h-full w-full object-contain"
                  />
                  {/* 카테고리 배지 */}
                  {lightboxLive.user_category && (
                    <div className="absolute left-3 top-3">
                      <CategoryLabel catKey={lightboxLive.user_category} />
                    </div>
                  )}
                </div>

                {/* 하단 액션 */}
                <div
                  className="shrink-0 px-4 pb-[5.5rem] pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {lightboxLive.description && (
                    <p className="mb-3 text-[13px] leading-snug text-white/60">{lightboxLive.description}</p>
                  )}

                  {/* 신고 버튼들 */}
                  <div className="flex items-center gap-2">
                    {/* 부적절 신고 */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAbuseMenu((v) => !v)}
                        disabled={abuseBusy}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white/45 transition-colors hover:text-white/70"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <Flag size={12} strokeWidth={2.2} />
                        신고
                      </button>
                      <AnimatePresence>
                        {showAbuseMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            className="absolute bottom-full left-0 mb-2 flex flex-col gap-1 rounded-xl border border-white/12 bg-[#1a1a28] p-2 shadow-xl"
                            style={{ minWidth: 120 }}
                          >
                            {ABUSE_CATS.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                disabled={abuseBusy}
                                onClick={() => handleContentAbuse(c.id)}
                                className="rounded-lg px-3 py-1.5 text-left text-[12px] text-white/65 transition-colors hover:bg-white/08 hover:text-white/90"
                              >
                                {c.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* 내 제보 + 관리자 삭제 */}
                    {(isAdmin || (userId && lightboxLive.user_id === userId)) && (
                      <>
                        {!adminDeleteConfirm ? (
                          <button
                            type="button"
                            onClick={() => setAdminDeleteConfirm(true)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-red-400/75 transition-colors hover:text-red-300"
                            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}
                          >
                            <Trash2 size={12} strokeWidth={2.2} />
                            {isAdmin ? '관리자 삭제' : '내 제보 삭제'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={adminDeleteBusy}
                              onClick={handleAdminDelete}
                              className="rounded-full px-3 py-1.5 text-[11px] font-bold text-red-300"
                              style={{ background: 'rgba(239,68,68,0.16)', border: '1px solid rgba(239,68,68,0.35)' }}
                            >
                              {adminDeleteBusy ? '삭제 중…' : '정말 삭제'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdminDeleteConfirm(false)}
                              className="rounded-full px-3 py-1.5 text-[11px] text-white/40"
                              style={{ border: '1px solid rgba(255,255,255,0.10)' }}
                            >
                              취소
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* 일반 신고(플래그) */}
                    {userId && !(lightboxLive.user_id && userId === lightboxLive.user_id) && (
                      <button
                        type="button"
                        disabled={flagBusy}
                        onClick={handleFlagReport}
                        className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-orange-400/70 transition-colors hover:text-orange-300"
                        style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)' }}
                      >
                        <Flag size={12} strokeWidth={2.2} />
                        부적절 신고
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
