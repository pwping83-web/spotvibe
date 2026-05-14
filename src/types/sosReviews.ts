/** DB 트리거 `sos_review_likes_refresh_review_meta` 의 threshold 와 동기 */
export const SOS_REVIEW_BEST_PROMO_LIKES = 20;

export interface SosReviewRow {
  id: string;
  user_id: string;
  region_key: string;
  body: string;
  lat: number | null;
  lng: number | null;
  like_count: number;
  promo_like_count: number;
  best_at: string | null;
  created_at: string;
}
