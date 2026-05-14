import { useCallback, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import type { SosReviewRow } from '@/types/sosReviews';
import { addSosReviewLike, fetchMySosReviewLikeIds, removeSosReviewLike } from '@/lib/sosReviewLikes';

export type SosReviewListMode = 'best' | 'all';

export function useSosReviewFeed(myUserId: string | null) {
  const [reviews, setReviews] = useState<SosReviewRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (regionKey: string, mode: SosReviewListMode) => {
    const sb = getSupabase();
    if (!sb || !regionKey) {
      setReviews([]);
      setLikedIds(new Set());
      return;
    }
    setLoading(true);
    try {
      let q = sb
        .from('sos_reviews')
        .select('id, user_id, region_key, body, lat, lng, like_count, promo_like_count, best_at, created_at')
        .eq('region_key', regionKey)
        .order(mode === 'best' ? 'promo_like_count' : 'created_at', { ascending: false });

      if (mode === 'best') {
        q = q.not('best_at', 'is', null);
      }

      const { data, error } = await q.limit(mode === 'best' ? 50 : 100);
      if (error) throw error;
      const rows = (data ?? []) as SosReviewRow[];
      setReviews(rows);

      if (myUserId && rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const mine = await fetchMySosReviewLikeIds(sb, myUserId, ids);
        setLikedIds(mine);
      } else {
        setLikedIds(new Set());
      }
    } catch {
      setReviews([]);
      setLikedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [myUserId]);

  const insertReview = useCallback(
    async (opts: { regionKey: string; body: string; lat?: number | null; lng?: number | null }) => {
      const sb = getSupabase();
      if (!sb || !myUserId) return { error: 'not_logged_in' as const };
      const body = opts.body.trim();
      if (body.length < 10) return { error: 'body_too_short' as const };
      const { data, error } = await sb
        .from('sos_reviews')
        .insert({
          user_id: myUserId,
          region_key: opts.regionKey,
          body,
          lat: opts.lat ?? null,
          lng: opts.lng ?? null,
        })
        .select('id, user_id, region_key, body, lat, lng, like_count, promo_like_count, best_at, created_at')
        .single();
      if (error) return { error: error.message };
      return { data: data as SosReviewRow };
    },
    [myUserId],
  );

  const toggleLike = useCallback(
    async (reviewId: string, authorUserId: string) => {
      const sb = getSupabase();
      if (!sb || !myUserId) return { error: 'not_logged_in' as const };
      if (authorUserId === myUserId) return { error: 'own_review' as const };

      const on = likedIds.has(reviewId);
      if (on) {
        const r = await removeSosReviewLike(sb, reviewId, myUserId);
        if (!r.ok) return { error: r.error ?? 'unlike_failed' };
        setLikedIds((prev) => {
          const n = new Set(prev);
          n.delete(reviewId);
          return n;
        });
      } else {
        const r = await addSosReviewLike(sb, reviewId, myUserId);
        if (!r.ok) return { error: r.error ?? 'like_failed' };
        setLikedIds((prev) => new Set(prev).add(reviewId));
      }

      setReviews((prev) =>
        prev.map((row) => {
          if (row.id !== reviewId) return row;
          const delta = on ? -1 : 1;
          return {
            ...row,
            like_count: Math.max(0, row.like_count + delta),
            promo_like_count: Math.max(0, row.promo_like_count + delta),
          };
        }),
      );

      return {} as const;
    },
    [myUserId, likedIds],
  );

  return { reviews, likedIds, loading, load, insertReview, toggleLike };
}
