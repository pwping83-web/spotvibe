import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import type { SpotReportAgeFilter } from '@/hooks/useSpotReports';

export interface FeaturedSpotReport {
  id: string;
  photo_url: string;
  lat: number;
  lng: number;
  ai_label: string | null;
  place_name: string | null;
  like_count: number;
  featured_in_events_at: string;
  created_at: string;
}

const WINDOW_DAYS = 60;
const REFETCH_MS = 60_000;
const LIMIT = 40;

/**
 * 타인 좋아요 임계값을 넘겨 `featured_in_events_at`이 찍힌 verified 제보.
 * 이벤트 탭 연령 필터와 동일하게 `reporter_age_bucket` 적용.
 */
export function useFeaturedSpotReports(
  enabled: boolean,
  ageFilter: SpotReportAgeFilter = 'all',
): { rows: FeaturedSpotReport[]; refetch: () => void } {
  const [rows, setRows] = useState<FeaturedSpotReport[]>([]);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      return;
    }

    async function load() {
      const sb = getSupabase();
      if (!sb) return;

      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

      let q = sb
        .from('spot_reports')
        .select(
          'id, photo_url, lat, lng, ai_label, place_name, like_count, featured_in_events_at, created_at, reporter_age_bucket',
        )
        .eq('status', 'verified')
        .not('featured_in_events_at', 'is', null)
        .gte('featured_in_events_at', since)
        .order('featured_in_events_at', { ascending: false })
        .limit(LIMIT);

      if (ageFilter !== 'all') {
        q = q.eq('reporter_age_bucket', ageFilter);
      }

      const { data, error } = await q;
      if (error || !data) return;
      setRows(data as FeaturedSpotReport[]);
    }

    void load();
    timerRef.current = setInterval(() => void load(), REFETCH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, ageFilter, tick]);

  return { rows, refetch };
}
