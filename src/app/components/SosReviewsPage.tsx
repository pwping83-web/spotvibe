import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Heart, Loader2, MapPin, PenLine, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/App';
import { EXPLORE_METRO_GROUPS, EXPLORE_REGION_PRESETS, presetsForMetro } from '@/app/constants/exploreRegions';
import { useSosReviewFeed, type SosReviewListMode } from '@/hooks/useSosReviews';
import { SOS_REVIEW_BEST_PROMO_LIKES } from '@/types/sosReviews';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  if (mins < 1440) return `${Math.floor(mins / 60)}시간 전`;
  return `${Math.floor(mins / 1440)}일 전`;
}

export function SosReviewsPage() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { reviews, likedIds, loading, load, insertReview, toggleLike } = useSosReviewFeed(userId);

  const defaultMetro = useMemo(
    () => EXPLORE_METRO_GROUPS.find((m) => m.id === 'seoul') ?? EXPLORE_METRO_GROUPS[0]!,
    [],
  );
  const [metroId, setMetroId] = useState(defaultMetro.id);
  const presets = useMemo(() => presetsForMetro(metroId, EXPLORE_REGION_PRESETS), [metroId]);
  const [presetId, setPresetId] = useState(() => presetsForMetro(defaultMetro.id, EXPLORE_REGION_PRESETS)[0]?.id ?? 'hongdae');
  const [listMode, setListMode] = useState<SosReviewListMode>('best');
  const [composeOpen, setComposeOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [likeBusy, setLikeBusy] = useState<string | null>(null);

  useEffect(() => {
    const list = presetsForMetro(metroId, EXPLORE_REGION_PRESETS);
    if (!list.some((p) => p.id === presetId)) {
      setPresetId(list[0]?.id ?? 'hongdae');
    }
  }, [metroId, presetId]);

  useEffect(() => {
    void load(presetId, listMode);
  }, [presetId, listMode, load]);

  const presetLabel = useMemo(
    () => EXPLORE_REGION_PRESETS.find((p) => p.id === presetId)?.label ?? presetId,
    [presetId],
  );

  const handleSubmit = useCallback(async () => {
    if (!userId) {
      toast.error('로그인이 필요해요.');
      return;
    }
    const t = body.trim();
    if (t.length < 10) {
      toast.error('후기는 10자 이상 입력해 주세요.');
      return;
    }
    setSending(true);
    try {
      const r = await insertReview({ regionKey: presetId, body: t });
      if ('error' in r) {
        if (r.error === 'body_too_short') toast.error('후기는 10자 이상이어야 해요.');
        else if (r.error === 'not_logged_in') toast.error('로그인이 필요해요.');
        else toast.error(r.error);
        return;
      }
      toast.success('후기가 등록되었어요. 이웃의 좋아요로 베스트에 올라갈 수 있어요!');
      setBody('');
      setComposeOpen(false);
      await load(presetId, listMode === 'best' ? 'all' : listMode);
      if (listMode === 'best') setListMode('all');
    } finally {
      setSending(false);
    }
  }, [body, insertReview, load, listMode, presetId, userId]);

  const onHeart = useCallback(
    async (reviewId: string, authorId: string) => {
      if (!userId) {
        toast.error('로그인이 필요해요.');
        return;
      }
      setLikeBusy(reviewId);
      try {
        const r = await toggleLike(reviewId, authorId);
        if ('error' in r && r.error) {
          if (r.error === 'own_review') toast.error('내 후기에는 좋아요를 누를 수 없어요.');
          else toast.error(r.error);
          return;
        }
        await load(presetId, listMode);
      } finally {
        setLikeBusy(null);
      }
    },
    [load, listMode, presetId, toggleLike, userId],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0A0E]">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70"
          aria-label="뒤로"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-bold text-white">SOS 지역 후기</h1>
          <p className="truncate text-[11px] text-white/40">
            타인 좋아요 {SOS_REVIEW_BEST_PROMO_LIKES}개 이상이면 베스트로 승격
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-3">
        {/* 광역 */}
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/35">지역</p>
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {EXPLORE_METRO_GROUPS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetroId(m.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                metroId === m.id
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF]'
                  : 'bg-white/[0.06] text-white/55'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* 세부 프리셋 */}
        <p className="mb-1.5 text-[11px] font-semibold text-white/35">세부 지역</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPresetId(p.id)}
              className={`rounded-full px-3 py-1 text-[11.5px] font-medium ${
                presetId === p.id
                  ? 'bg-white/15 text-white'
                  : 'bg-white/[0.04] text-white/45'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 베스트 / 전체 */}
        <div className="mb-3 flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setListMode('best')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold ${
              listMode === 'best' ? 'bg-amber-500/20 text-amber-200' : 'text-white/45'
            }`}
          >
            <Sparkles size={14} />
            베스트만
          </button>
          <button
            type="button"
            onClick={() => setListMode('all')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold ${
              listMode === 'all' ? 'bg-white/12 text-white' : 'text-white/45'
            }`}
          >
            <MapPin size={14} />
            전체 후기
          </button>
        </div>

        <p className="mb-2 text-[11px] leading-relaxed text-white/38">
          {listMode === 'best'
            ? `「${presetLabel}」에서 타인 좋아요 ${SOS_REVIEW_BEST_PROMO_LIKES}개 이상 받은 후기만 표시됩니다.`
            : `「${presetLabel}」의 최근 후기입니다. 마음에 드는 글에 좋아요를 눌러 베스트로 올려 주세요.`}
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-white/30" size={28} />
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-[13px] text-white/40">
            {listMode === 'best' ? '아직 베스트 후기가 없어요.' : '아직 후기가 없어요. 첫 후기를 남겨 보세요!'}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => {
              const mine = userId && r.user_id === userId;
              const liked = likedIds.has(r.id);
              const busy = likeBusy === r.id;
              const isBest = Boolean(r.best_at);
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isBest && (
                        <span className="rounded-md bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                          베스트
                        </span>
                      )}
                      <span className="text-[10px] text-white/35">{relativeTime(r.created_at)}</span>
                      {mine && (
                        <span className="rounded-md bg-[#00F0FF]/15 px-2 py-0.5 text-[10px] font-semibold text-[#00F0FF]">
                          내 후기
                        </span>
                      )}
                    </div>
                    {!mine && userId && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onHeart(r.id, r.user_id)}
                        className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white/70 disabled:opacity-40"
                      >
                        {busy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Heart size={14} className={liked ? 'fill-rose-400 text-rose-400' : ''} />
                        )}
                        {r.like_count}
                      </button>
                    )}
                    {mine && (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-white/35">
                        <Heart size={14} /> {r.like_count}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">{r.body}</p>
                  {!isBest && (
                    <p className="mt-2 text-[10px] text-white/30">
                      타인 좋아요 {r.promo_like_count}/{SOS_REVIEW_BEST_PROMO_LIKES}
                      {mine ? ' — 이웃이 좋아요를 눌러 주면 베스트로 승격돼요' : ' → 베스트 승격'}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 작성 */}
      <div className="shrink-0 border-t border-white/[0.08] bg-[#0A0A0E] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {!composeOpen ? (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500/90 to-orange-500/90 py-3.5 text-[14px] font-bold text-white shadow-lg"
          >
            <PenLine size={18} />
            이 지역 후기 쓰기
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-white/45">
              선택 지역: <span className="font-semibold text-white/75">{presetLabel}</span>
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="SOS·이웃 도움 경험을 10자 이상 적어 주세요 (허위·명예훼손 금지)"
              rows={5}
              maxLength={2000}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#00F0FF]/40"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setComposeOpen(false);
                  setBody('');
                }}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-[13px] font-semibold text-white/55"
              >
                취소
              </button>
              <button
                type="button"
                disabled={sending || body.trim().length < 10}
                onClick={() => void handleSubmit()}
                className="flex-[2] rounded-xl bg-[#00F0FF]/25 py-2.5 text-[13px] font-bold text-[#00F0FF] disabled:opacity-35"
              >
                {sending ? <Loader2 className="mx-auto animate-spin" size={18} /> : '등록'}
              </button>
            </div>
          </div>
        )}
        <Link to="/" className="mt-2 block text-center text-[11px] text-white/30 underline">
          지도로 돌아가기
        </Link>
      </div>
    </div>
  );
}
