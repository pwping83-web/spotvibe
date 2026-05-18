import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import type { GalleryCategoryKey } from '@/lib/photoCategories';

export const PHOTO_GALLERY_WINDOW_DAYS = 7;
export const PHOTO_GALLERY_PAGE_SIZE = 60;

export interface CommunityPhoto {
  id: string;
  photo_url: string;
  ai_label: string | null;
  place_name: string | null;
  description: string | null;
  /** 표시용 카테고리: admin_category > user_category > ai_category 우선순위 적용 후 값 */
  display_category: string | null;
  /** 원본 필드 — 갤러리 필터링용 */
  user_category: string | null;
  ai_category: string | null;
  admin_category: string | null;
  ai_category_confidence: number | null;
  created_at: string;
  user_id: string | null;
  like_count: number;
}

/**
 * 카테고리 우선순위: admin_category > user_category > ai_category
 * 모두 없으면 null
 */
function resolveDisplayCategory(
  admin: string | null,
  user: string | null,
  ai: string | null,
): string | null {
  return admin ?? user ?? ai ?? null;
}

/**
 * 커뮤니티 사진 갤러리 — 전역(반경 제한 없음), 최근 7일, 카테고리 필터
 *
 * `category = 'all'` 이면 필터 없이 전체 조회.
 * 카테고리 필터는 admin_category → user_category → ai_category 순으로 매칭.
 */
export function usePhotoCommunity(
  category: GalleryCategoryKey,
  enabled: boolean,
  refreshKey: number,
): { photos: CommunityPhoto[]; loading: boolean } {
  const [photos, setPhotos] = useState<CommunityPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setPhotos([]);
      return;
    }
    const sb = getSupabase();
    if (!sb) return;

    abortRef.current = false;
    setLoading(true);

    const since = new Date(
      Date.now() - PHOTO_GALLERY_WINDOW_DAYS * 86_400_000,
    ).toISOString();

    let query = sb
      .from('spot_reports')
      .select(
        'id, photo_url, ai_label, place_name, description, user_category, ai_category, admin_category, ai_category_confidence, created_at, user_id, like_count',
      )
      .eq('status', 'verified')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(PHOTO_GALLERY_PAGE_SIZE);

    // 카테고리 필터: admin_category or user_category or ai_category 중 하나라도 일치
    if (category !== 'all') {
      query = query.or(
        `admin_category.eq.${category},user_category.eq.${category},ai_category.eq.${category}`,
      );
    }

    query.then(({ data, error }) => {
      if (abortRef.current) return;
      setLoading(false);
      if (error) {
        console.error('[usePhotoCommunity]', error);
        return;
      }
      setPhotos(
        (data ?? []).map((r) => ({
          id: r.id,
          photo_url: r.photo_url,
          ai_label: r.ai_label ?? null,
          place_name: r.place_name ?? null,
          description: r.description ?? null,
          user_category: r.user_category ?? null,
          ai_category: r.ai_category ?? null,
          admin_category: r.admin_category ?? null,
          ai_category_confidence: r.ai_category_confidence ?? null,
          display_category: resolveDisplayCategory(
            r.admin_category ?? null,
            r.user_category ?? null,
            r.ai_category ?? null,
          ),
          created_at: r.created_at,
          user_id: r.user_id ?? null,
          like_count: r.like_count ?? 0,
        })),
      );
    });

    return () => {
      abortRef.current = true;
    };
  }, [category, enabled, refreshKey]);

  return { photos, loading };
}
