import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Flag, MapPin, Shield, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/App';
import { useMySpotReportLikes } from '@/hooks/useMySpotReportLikes';
import {
  NEARBY_LIVE_PHOTOS_RADIUS_KM,
  useNearbyLivePhotos,
  type NearbyLivePhoto,
} from '@/hooks/useNearbyLivePhotos';
import { addSpotReportLike, removeSpotReportLike } from '@/lib/spotReportLikes';
import { adminDeleteSpotReport } from '@/lib/adminDeleteSpotReport';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { FaceMosaicImage } from './FaceMosaicImage';
import { SpotReportLikeChip } from './SpotReportLikeChip';

/** DB `flag_spot_report` 의 신고 숨김 기준과 동일 */
const FLAG_HIDE_THRESHOLD = 20;

const SPOT_CONTENT_ABUSE_CATS = [
  { id: 'promo_spam' as const, label: '홍보·스팸' },
  { id: 'sexual' as const, label: '음란' },
  { id: 'crime_related' as const, label: '범죄·불법' },
  { id: 'other' as const, label: '기타' },
];

function formatDist(km: number): string {
  if (km < 0.1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  return `${Math.floor(mins / 60)}시간 전`;
}

function PhotoTile({
  item,
  onOpen,
  liked,
  likeBusy,
  onToggleLike,
  userId,
}: {
  item: NearbyLivePhoto;
  onOpen: (item: NearbyLivePhoto) => void;
  liked: boolean;
  likeBusy: boolean;
  onToggleLike: (reportId: string) => void;
  userId: string | null;
}) {
  const own = !!(userId && item.user_id && userId === item.user_id);
  const likeCount = item.like_count ?? 0;
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 text-left">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="absolute inset-0 z-0 text-left outline-none ring-[#00F0FF]/40 focus-visible:ring-2"
        aria-label="사진 크게 보기"
      >
        <div className="relative h-full min-h-0 w-full overflow-hidden bg-white/5">
          <FaceMosaicImage
            src={item.photo_url}
            alt={item.ai_label ?? '현장 제보'}
            className="relative h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        </div>
      </button>
      <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col justify-end">
        <div className="pointer-events-none flex-1 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
        <div className="shrink-0 px-3 pb-2 pt-6 sm:pt-8">
          <p className="truncate text-[12px] font-bold text-white sm:text-[13px]">{item.ai_label ?? '현장 제보'}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/55 sm:text-[11px]">
            <MapPin size={12} className="shrink-0 opacity-70" />
            <span>{formatDist(item.distKm)}</span>
            <span className="text-white/30">·</span>
            <span>{relativeTime(item.created_at)}</span>
          </p>
        </div>
      </div>
      <div className="absolute right-2 top-2 z-[2]">
        <SpotReportLikeChip
          compact
          count={likeCount}
          liked={liked}
          disabled={!userId || own}
          busy={likeBusy}
          onClick={() => onToggleLike(item.id)}
        />
      </div>
    </div>
  );
}

export interface NearbyLivePhotosModalProps {
  open: boolean;
  onClose: () => void;
  /** 지도 탐색 중심(또는 내 위치에 맞춘 앵커) */
  mapCenter: [number, number] | null;
  radiusKm?: number;
  enabled: boolean;
  /** 관리자만: 제보·Storage 원본 즉시 삭제(비상 모더레이션) */
  isAdmin?: boolean;
  /** 삭제·신고 등 반영 후 상위에서 데이터 다시 불러오기 */
  onModeration?: () => void;
}

/** 주변 검증된 현장 사진을 그리드로 보여 줌. 썸네일 탭 시 원본 크게 표시. */
export function NearbyLivePhotosModal({
  open,
  onClose,
  mapCenter,
  radiusKm = NEARBY_LIVE_PHOTOS_RADIUS_KM,
  enabled,
  isAdmin = false,
  onModeration,
}: NearbyLivePhotosModalProps) {
  const { userId } = useAuth();
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const photos = useNearbyLivePhotos(
    mapCenter,
    radiusKm,
    open && enabled && mapCenter !== null,
    listRefreshKey,
  );
  const [lightbox, setLightbox] = useState<NearbyLivePhoto | null>(null);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);
  const [flagBusy, setFlagBusy] = useState(false);
  const [abuseBusy, setAbuseBusy] = useState(false);
  const [adminDeleteBusy, setAdminDeleteBusy] = useState(false);
  const [adminDeleteConfirm, setAdminDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!open) setLightbox(null);
  }, [open]);

  useEffect(() => {
    setAdminDeleteConfirm(false);
  }, [lightbox?.id]);

  const supabaseOk = isSupabaseConfigured();
  const reportIdsForLikes = useMemo(() => photos.map((p) => p.id), [photos]);
  const { likedSet, refresh: refreshLikes } = useMySpotReportLikes(
    supabaseOk && open && enabled && mapCenter !== null && !!userId,
    userId,
    reportIdsForLikes,
  );

  const lightboxLive = useMemo(() => {
    if (!lightbox) return null;
    return photos.find((p) => p.id === lightbox.id) ?? lightbox;
  }, [lightbox, photos]);

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
        setListRefreshKey((k) => k + 1);
      } finally {
        setLikeBusyId(null);
      }
    },
    [userId, likedSet, refreshLikes],
  );

  const handleFlagReport = useCallback(async () => {
    if (!lightbox || flagBusy) return;
    if (!userId) {
      toast.error('로그인 후 신고할 수 있어요.');
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      toast.error('연결 설정을 확인해 주세요.');
      return;
    }
    setFlagBusy(true);
    try {
      const { data, error } = await sb.rpc('flag_spot_report', { p_report_id: lightbox.id });
      if (error) {
        console.error('flag_spot_report:', error);
        toast.error('신고 처리에 실패했어요.', { description: error.message });
        return;
      }
      const row = data as {
        ok?: boolean;
        error?: string;
        count?: number;
        new_flag?: boolean;
        auto_hidden?: boolean;
      };
      if (!row?.ok) {
        if (row.error === 'own_report') {
          toast.error('본인이 올린 제보는 신고할 수 없어요.');
        } else if (row.error === 'not_flaggable') {
          toast.error('이미 내려간 제보라 신고할 수 없어요.');
        } else {
          toast.error('신고할 수 없어요.');
        }
        return;
      }
      const cnt = typeof row.count === 'number' ? row.count : 0;
      if (!row.new_flag) {
        toast.message('이미 신고한 제보예요', {
          description: `서로 다른 사용자 신고 ${cnt}/${FLAG_HIDE_THRESHOLD}명`,
        });
        return;
      }
      toast.success('신고가 접수됐어요', {
        description: `서로 다른 사용자 ${cnt}/${FLAG_HIDE_THRESHOLD}명 · ${FLAG_HIDE_THRESHOLD}명이면 피드에서 내려가요`,
      });
      if (row.auto_hidden) {
        toast.message('다수 신고로 피드에서 내려갔어요');
        setLightbox(null);
      }
      setListRefreshKey((k) => k + 1);
    } finally {
      setFlagBusy(false);
    }
  }, [lightbox, flagBusy, userId]);

  const handleContentAbuse = useCallback(
    async (category: (typeof SPOT_CONTENT_ABUSE_CATS)[number]['id']) => {
      if (!lightboxLive || abuseBusy) return;
      if (!userId) {
        toast.error('로그인 후 신고할 수 있어요.');
        return;
      }
      if (lightboxLive.user_id && userId === lightboxLive.user_id) {
        toast.error('본인 제보는 신고할 수 없어요.');
        return;
      }
      const sb = getSupabase();
      if (!sb) {
        toast.error('연결 설정을 확인해 주세요.');
        return;
      }
      setAbuseBusy(true);
      try {
        const { data, error } = await sb.rpc('submit_content_abuse_report', {
          p_content_type: 'spot_report',
          p_content_id: lightboxLive.id,
          p_category: category,
          p_detail: null,
        });
        if (error) {
          toast.error('유형 신고에 실패했어요.', { description: error.message });
          return;
        }
        const row = data as { ok?: boolean; error?: string };
        if (!row?.ok) {
          toast.error('신고할 수 없어요.', { description: row?.error ?? '' });
          return;
        }
        toast.success('유형 지정 신고가 접수됐어요.', {
          description: '서로 다른 5명 이상 신고 시 계정이 일시 제한될 수 있어요. 관리자가 검토합니다.',
        });
      } finally {
        setAbuseBusy(false);
      }
    },
    [lightboxLive, abuseBusy, userId],
  );

  const handleAdminHardDelete = useCallback(async () => {
    if (!lightbox || adminDeleteBusy) return;
    const sb = getSupabase();
    if (!sb) {
      toast.error('연결 설정을 확인해 주세요.');
      return;
    }
    setAdminDeleteBusy(true);
    try {
      const result = await adminDeleteSpotReport(sb, lightbox.id);
      if (!result.ok) {
        console.error('adminDeleteSpotReport:', result.message);
        toast.error('삭제에 실패했어요.', { description: result.message });
        return;
      }
      toast.success('제보와 원본 파일을 삭제했어요.');
      setLightbox(null);
      setAdminDeleteConfirm(false);
      setListRefreshKey((k) => k + 1);
      onModeration?.();
    } finally {
      setAdminDeleteBusy(false);
    }
  }, [lightbox, adminDeleteBusy, onModeration]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="닫기"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[460] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="nearby-live-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="absolute inset-x-2 bottom-[5.25rem] top-[6.25rem] z-[470] flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#12121a] shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/08 px-4 py-3">
              <div>
                <h2 id="nearby-live-title" className="text-[15px] font-bold text-white">
                  실시간 현장 사진
                </h2>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/38">
                  <Shield size={11} className="text-[#00F0FF]/70" />
                  최근 2시간 · 반경 {radiusKm}km
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/08 text-white/60"
              >
                <X size={18} />
              </button>
            </div>
            <div className="shrink-0 border-b border-white/[0.05] bg-black/20 px-3 py-1.5">
              <p className="text-center text-[9px] leading-snug text-white/34">
                하트는 로그인 후 · 본인 제보엔 불가 · 타인 좋아요 20개 이상이면 이벤트 핫 픽 · 사진 탭 → 깃발·유형 신고 ·
                다른 사람 <span className="text-white/48">{FLAG_HIDE_THRESHOLD}</span>명(각 1회)이면 비공개 · 서로 다른 5명
                유형 신고 시 일시 제한 · 반복·악용 시 제재
              </p>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1.5"
              style={{ scrollbarWidth: 'none' }}
            >
              {photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-2 py-14 text-center">
                  <p className="text-[14px] font-semibold text-white/65">아직 주변 사진이 없어요</p>
                  <p className="max-w-[260px] text-[12px] leading-relaxed text-white/42">
                    지도에서 <span className="text-white/55">현장 제보</span>를 올리면 여기에 나타나요.
                  </p>
                </div>
              ) : (
                <div
                  className="grid grid-cols-1 gap-2"
                  style={{
                    /* 1열 × 약 4줄이 한 화면에 들어가도록 행 높이 ≈ 가용 높이의 1/4 */
                    gridAutoRows: 'max(5.5rem, calc((100svh - 17rem) / 4 - 4px))',
                  }}
                >
                  {photos.map((p) => (
                    <PhotoTile
                      key={p.id}
                      item={p}
                      onOpen={setLightbox}
                      liked={likedSet.has(p.id)}
                      likeBusy={likeBusyId === p.id}
                      onToggleLike={(id) => void handleToggleLike(id)}
                      userId={userId}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          <AnimatePresence>
            {lightbox && lightboxLive && (
              <motion.div
                role="presentation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[480] flex items-center justify-center bg-black/88 p-3"
                onClick={() => setLightbox(null)}
              >
                <motion.div
                  initial={{ scale: 0.94 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.94 }}
                  className="flex max-h-[min(88dvh,760px)] max-w-[min(100%,28rem)] flex-col overflow-hidden rounded-xl bg-[#1a1a24] shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative shrink-0 bg-black/50">
                    <FaceMosaicImage
                      src={lightboxLive.photo_url}
                      alt={lightboxLive.ai_label ?? '현장 제보'}
                      className="relative w-full"
                      imgClassName="max-h-[min(52dvh,420px)] w-full object-contain"
                    />
                    <div className="absolute right-2 top-2 flex gap-1.5">
                      {isAdmin ? (
                        <button
                          type="button"
                          disabled={adminDeleteBusy}
                          onClick={() => setAdminDeleteConfirm((c) => !c)}
                          className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-full px-2 ring-1 disabled:opacity-40 ${
                            adminDeleteConfirm
                              ? 'bg-red-600/95 text-white ring-red-400/80'
                              : 'bg-black/60 text-red-300 ring-red-500/35'
                          }`}
                          aria-label={adminDeleteConfirm ? '삭제 준비 취소' : '관리자 강제 삭제 준비'}
                          title={
                            adminDeleteConfirm
                              ? '삭제 준비 취소'
                              : '부적절·불법 제보 — 누른 뒤 아래에서 영구 삭제'
                          }
                        >
                          <Trash2 size={17} strokeWidth={2.2} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={flagBusy || !userId}
                        onClick={() => void handleFlagReport()}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/55 ring-1 ring-white/12 disabled:opacity-40"
                        aria-label="사진 신고"
                        title="부적절·허위 제보 신고"
                      >
                        <Flag size={17} strokeWidth={2} className="text-white/55" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightbox(null)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white"
                        aria-label="닫기"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[min(32dvh,220px)] min-h-0 shrink space-y-2 overflow-y-auto px-4 py-3 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#00F0FF]/80">
                      제보 내용
                    </p>
                    {lightboxLive.place_name?.trim() ? (
                      <p className="text-[15px] font-bold leading-snug text-white">{lightboxLive.place_name.trim()}</p>
                    ) : null}
                    {lightboxLive.description?.trim() ? (
                      <p className="text-[13px] leading-relaxed text-white/85">{lightboxLive.description.trim()}</p>
                    ) : null}
                    {!lightboxLive.place_name?.trim() && !lightboxLive.description?.trim() ? (
                      <p className="text-[12px] text-white/45">장소 이름·설명을 적지 않은 제보예요.</p>
                    ) : null}
                    <p className="flex items-center gap-1 border-t border-white/10 pt-2 text-[11px] text-white/45">
                      <MapPin size={11} className="shrink-0" />
                      <span>{formatDist(lightboxLive.distKm)}</span>
                      <span className="text-white/25">·</span>
                      <span>{relativeTime(lightboxLive.created_at)}</span>
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <span className="text-[10px] text-white/35">좋아요</span>
                      <SpotReportLikeChip
                        count={lightboxLive.like_count ?? 0}
                        liked={likedSet.has(lightboxLive.id)}
                        disabled={
                          !userId ||
                          !!(userId && lightboxLive.user_id && userId === lightboxLive.user_id)
                        }
                        busy={likeBusyId === lightboxLive.id}
                        onClick={() => void handleToggleLike(lightboxLive.id)}
                      />
                    </div>
                    {isAdmin && adminDeleteConfirm ? (
                      <div className="mt-1 space-y-2 rounded-xl border border-red-500/40 bg-red-950/35 px-3 py-2.5">
                        <p className="text-[11px] font-semibold leading-snug text-red-100/95">
                          한 번 더 누르면 이 제보와 Storage 원본이 즉시 삭제돼요. 되돌릴 수 없어요.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={adminDeleteBusy}
                            onClick={() => setAdminDeleteConfirm(false)}
                            className="flex-1 rounded-lg border border-white/15 py-2 text-[11px] font-semibold text-white/75 active:scale-[0.99] disabled:opacity-40"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={adminDeleteBusy}
                            onClick={() => void handleAdminHardDelete()}
                            className="flex-1 rounded-lg bg-red-600 py-2 text-[11px] font-bold text-white active:scale-[0.99] disabled:opacity-40"
                          >
                            {adminDeleteBusy ? '삭제 중…' : '영구 삭제'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={flagBusy || !userId}
                      onClick={() => void handleFlagReport()}
                      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] py-2.5 text-[12px] font-medium text-white/70 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Flag size={15} strokeWidth={2} className="shrink-0 text-white/55" />
                      {flagBusy ? '처리 중…' : '사진 신고하기'}
                    </button>
                    {userId &&
                    (!lightboxLive.user_id || lightboxLive.user_id !== userId) ? (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-[10px] font-medium text-white/42">유형 지정 신고</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {SPOT_CONTENT_ABUSE_CATS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              disabled={abuseBusy || flagBusy}
                              onClick={() => void handleContentAbuse(c.id)}
                              className="rounded-lg border border-white/10 bg-white/[0.05] py-2 text-[11px] font-medium text-white/72 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <p className="text-center text-[9px] leading-snug text-white/32">
                      타인 {FLAG_HIDE_THRESHOLD}명 깃발 신고 시 비공개 · 서로 다른 5명 유형 신고 시 일시 제한 · 악용 시
                      제재
                      {isAdmin ? ' · 관리자는 휴지통으로 즉시 삭제 가능' : ''}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
