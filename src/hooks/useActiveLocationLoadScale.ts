import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  adaptiveLocationWriteIntervalMs,
  adaptivePeerRefetchIntervalMs,
} from '@/lib/adaptiveLocationInterval';

/** `useMatchedUsers` stale 기준과 맞춤 — 최근 갱신된 위치 공유만 집계 */
const COUNT_STALE_MINUTES = 5;
const COUNT_REFRESH_MS = 60_000;

/**
 * 최근 `explore_*`를 쓴 프로필 수(대략 동시 접속·위치 공유 부하)를 주기적으로 세고,
 * 그에 맞춰 위치 DB 쓰기·피어 목록 폴링 주기를 돌려준다.
 */
export function useActiveLocationLoadScale(enabled: boolean): {
  writeIntervalMs: number;
  refetchIntervalMs: number;
} {
  const [writeIntervalMs, setWriteIntervalMs] = useState(() => adaptiveLocationWriteIntervalMs(2));
  const [refetchIntervalMs, setRefetchIntervalMs] = useState(() => adaptivePeerRefetchIntervalMs(2));

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) {
      setWriteIntervalMs(adaptiveLocationWriteIntervalMs(2));
      setRefetchIntervalMs(adaptivePeerRefetchIntervalMs(2));
      return;
    }

    const sb = getSupabase();
    if (!sb) return;

    let cancelled = false;

    async function refresh() {
      const staleIso = new Date(Date.now() - COUNT_STALE_MINUTES * 60_000).toISOString();
      const { count, error } = await sb
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('explore_lat', 'is', null)
        .not('explore_lng', 'is', null)
        .gte('updated_at', staleIso);

      if (cancelled) return;
      if (error) {
        console.warn('[useActiveLocationLoadScale]', error.message);
        return;
      }

      const nRaw = count ?? 0;
      const n = Math.max(nRaw, 2);
      setWriteIntervalMs(adaptiveLocationWriteIntervalMs(n));
      setRefetchIntervalMs(adaptivePeerRefetchIntervalMs(n));
    }

    void refresh();
    const id = window.setInterval(() => void refresh(), COUNT_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return { writeIntervalMs, refetchIntervalMs };
}
