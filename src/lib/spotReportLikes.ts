import type { SupabaseClient } from '@supabase/supabase-js';

/** DB 트리거 `spot_report_likes_refresh_report_meta` 의 threshold 와 동일 */
export const SPOT_REPORT_FEATURE_PROMOTION_LIKES = 20;

export async function fetchMySpotReportLikeIds(
  sb: SupabaseClient,
  userId: string,
  reportIds: string[],
): Promise<Set<string>> {
  if (reportIds.length === 0) return new Set();
  const { data, error } = await sb
    .from('spot_report_likes')
    .select('report_id')
    .eq('user_id', userId)
    .in('report_id', reportIds);
  if (error || !data) return new Set();
  return new Set(data.map((r: { report_id: string }) => r.report_id));
}

export async function addSpotReportLike(
  sb: SupabaseClient,
  reportId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.from('spot_report_likes').insert({ report_id: reportId, user_id: userId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeSpotReportLike(
  sb: SupabaseClient,
  reportId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.from('spot_report_likes').delete().eq('report_id', reportId).eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
