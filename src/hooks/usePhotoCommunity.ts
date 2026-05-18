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
  user_category: string | null;
  created_at: string;
  user_id: string | null;
  like_count: number;
}

/**
 * 커뮤니티 사진 갤러리 — 전역(반경 제한 없음), 최근 7일, 카테고리 필터
 *
 * `category = 'all'` 이면 user_category 필터 없이 전체 조회.
 * 카테고리가 지정된 경우 해당 카테고리만 반환.
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
        'id, photo_url, ai_label, place_name, description, user_category, created_at, user_id, like_count',
      )
      .eq('status', 'verified')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(PHOTO_GALLERY_PAGE_SIZE);

    if (category !== 'all') {
      query = query.eq('user_category', category);
    } else {
      // 전체 탭에서는 user_category가 있는 제보를 우선 노출 (null도 포함)
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
