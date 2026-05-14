import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { fetchMySpotReportLikeIds } from '@/lib/spotReportLikes';

/**
 * 현재 로그인 사용자가 주어진 제보 id 중 어디에 좋아요를 눌렀는지.
 */
export function useMySpotReportLikes(
  enabled: boolean,
  userId: string | null,
  reportIds: string[],
): { likedSet: Set<string>; refresh: () => void } {
  const [likedSet, setLikedSet] = useState<Set<string>>(() => new Set());
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const idFingerprint = useMemo(
    () => [...new Set(reportIds)].filter(Boolean).sort().join(','),
    [reportIds],
  );

  useEffect(() => {
    if (!enabled || !userId || !idFingerprint) {
      setLikedSet(new Set());
      return;
    }

    const uniq = idFingerprint.split(',');

    let cancelled = false;
    const sb = getSupabase();
    if (!sb) {
      setLikedSet(new Set());
      return;
    }

    void fetchMySpotReportLikeIds(sb, userId, uniq).then((s) => {
      if (!cancelled) setLikedSet(s);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, userId, idFingerprint, version]);

  return { likedSet, refresh };
}
