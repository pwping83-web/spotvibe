import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

export interface SpotEvent {
  /** 클러스터 대표 좌표 (첫 번째 제보 기준) */
  lat: number;
  lng: number;
  /** AI가 붙인 이벤트 이름 (가장 최근 제보 기준) */
  label: string;
  /** 이벤트 카테고리 */
  category: 'performance' | 'market' | 'crowd' | 'other';
  /** 클러스터 내 제보 수 */
  reportCount: number;
  /** 2명 이상 제보 = 확인된 이벤트 */
  isConfirmed: boolean;
  /** 가장 최근 제보 시각 */
  latestAt: string;
  /** 클러스터 내 사진 URL 목록 (최대 3장) */
  photoUrls: string[];
  /** 클러스터에 포함된 제보 id (관리자 삭제용) */
  reportIds: string[];
  /** 클러스터 내 좋아요 합(표시용) */
  likeTotal: number;
  /** 좋아요 UI·토글에 쓰는 대표 제보 id(가장 최근 제보) */
  primaryReportId: string;
}

/** 이벤트 탭 연령 칩과 동일 (DB `reporter_age_bucket`) */
export type SpotReportAgeFilter = 'all' | '20s' | '30s' | '40s';

interface RawReport {
  id: string;
  photo_url: string;
  lat: number;
  lng: number;
  ai_label: string | null;
  ai_category: string | null;
  created_at: string;
  reporter_age_bucket: string | null;
  like_count: number | null;
}

const CLUSTER_RADIUS_KM = 0.2;  // 200m
const WINDOW_HOURS = 2;          // 최근 2시간 제보만
const REFETCH_MS = 60_000;       // 1분마다 재쿼리

/** km 단위 두 좌표 간 거리 (Haversine 근사) */
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 개별 제보 목록을 200m 반경으로 클러스터링 */
function clusterReports(reports: RawReport[]): SpotEvent[] {
  const used = new Set<string>();
  const events: SpotEvent[] = [];

  // created_at 내림차순 정렬 (최신 우선)
  const sorted = [...reports].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const seed of sorted) {
    if (used.has(seed.id)) continue;

    const cluster: RawReport[] = [seed];
    used.add(seed.id);

    for (const other of sorted) {
      if (used.has(other.id)) continue;
      if (distKm(seed.lat, seed.lng, other.lat, other.lng) <= CLUSTER_RADIUS_KM) {
        cluster.push(other);
        used.add(other.id);
      }
    }

    const latest = cluster[0];
    const rawCat = latest.ai_category ?? 'other';
    const category: SpotEvent['category'] =
      rawCat === 'performance' || rawCat === 'market' || rawCat === 'crowd'
        ? rawCat
        : 'other';

    const likeTotal = cluster.reduce((s, r) => s + (Number(r.like_count) || 0), 0);

    events.push({
      lat: seed.lat,
      lng: seed.lng,
      label: latest.ai_label ?? '현장 제보',
      category,
      reportCount: cluster.length,
      isConfirmed: cluster.length >= 2,
      latestAt: latest.created_at,
      photoUrls: cluster.slice(0, 3).map((r) => r.photo_url),
      reportIds: cluster.map((r) => r.id),
      likeTotal,
      primaryReportId: latest.id,
    });
  }

  return events;
}

/**
 * 최근 2시간 이내 verified 제보를 200m 단위로 클러스터링해 SpotEvent 목록 반환.
 * ageFilter가 all이 아니면 해당 연령 버킷 제보만 조회.
 * enabled=false 이거나 Supabase 미설정이면 빈 배열.
 */
export function useSpotReports(
  enabled: boolean,
  ageFilter: SpotReportAgeFilter = 'all',
): { events: SpotEvent[]; refetch: () => void } {
  const [events, setEvents] = useState<SpotEvent[]>([]);
  const [fetchVersion, setFetchVersion] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refetch = useCallback(() => setFetchVersion((v) => v + 1), []);

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      return;
    }

    async function fetchReports() {
      const sb = getSupabase();
      if (!sb) return;

      const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

      let q = sb
        .from('spot_reports')
        .select(
          'id, photo_url, lat, lng, ai_label, ai_category, created_at, reporter_age_bucket, like_count',
        )
        .eq('status', 'verified')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300);

      if (ageFilter !== 'all') {
        q = q.eq('reporter_age_bucket', ageFilter);
      }

      const { data, error } = await q;

      if (error || !data) return;

      setEvents(clusterReports(data as RawReport[]));
    }

    fetchReports();
    timerRef.current = setInterval(fetchReports, REFETCH_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, ageFilter, fetchVersion]);

  return { events, refetch };
}
