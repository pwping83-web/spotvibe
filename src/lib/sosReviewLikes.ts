import type { SupabaseClient } from '@supabase/supabase-js';
import { SOS_REVIEW_BEST_PROMO_LIKES } from '@/types/sosReviews';

export { SOS_REVIEW_BEST_PROMO_LIKES };

export async function fetchMySosReviewLikeIds(
  sb: SupabaseClient,
  userId: string,
  reviewIds: string[],
): Promise<Set<string>> {
  if (reviewIds.length === 0) return new Set();
  const { data, error } = await sb
    .from('sos_review_likes')
    .select('review_id')
    .eq('user_id', userId)
    .in('review_id', reviewIds);
  if (error || !data) return new Set();
  return new Set(data.map((r: { review_id: string }) => r.review_id));
}

export async function addSosReviewLike(
  sb: SupabaseClient,
  reviewId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.from('sos_review_likes').insert({ review_id: reviewId, user_id: userId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeSosReviewLike(
  sb: SupabaseClient,
  reviewId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb
    .from('sos_review_likes')
    .delete()
    .eq('review_id', reviewId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
