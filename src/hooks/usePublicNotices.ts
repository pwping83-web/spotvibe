import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

export interface PublicNotice {
  id: string;
  source: 'disaster_sms' | 'rss' | string;
  category: 'fire' | 'flood' | 'earthquake' | 'event' | 'safety' | 'general' | string;
  region_name: string | null;
  title: string;
  body: string | null;
  external_url: string | null;
  issued_at: string;
  expires_at: string | null;
  lat: number | null;
  lng: number | null;
}

const REFETCH_MS = 5 * 60_000; // 5분마다 재쿼리

export function usePublicNotices(enabled: boolean) {
  const [notices, setNotices] = useState<PublicNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    const sb = getSupabase();
    if (!sb) return;

    setLoading(true);
    try {
      // 최근 48시간 이내, 만료되지 않은 공지만 조회
      const cutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();
      const now = new Date().toISOString();

      const { data, error } = await sb
        .from('public_notices')
        .select('id,source,category,region_name,title,body,external_url,issued_at,expires_at,lat,lng')
        .eq('is_active', true)
        .gte('issued_at', cutoff)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('issued_at', { ascending: false })
        .limit(40);

      if (error) {
        console.error('[usePublicNotices]', error.message);
        return;
      }
      setNotices((data ?? []) as PublicNotice[]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void fetch();
    timerRef.current = setInterval(() => void fetch(), REFETCH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch]);

  return { notices, loading, refetch: fetch };
}
