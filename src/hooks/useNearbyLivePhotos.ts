import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

/** 실시간 현장 사진 피드 — 기준점 기준 이 거리(km) 안만 표시 */
export const NEARBY_LIVE_PHOTOS_RADIUS_KM = 5;

export interface NearbyLivePhoto {
  id: string;
  photo_url: string;
  lat: number;
  lng: number;
  ai_label: string | null;
  /** 제보 시 입력한 장소 이름 */
  place_name: string | null;
  /** 제보 시 입력한 한 줄 설명 */
  description: string | null;
  created_at: string;
  distKm: number;
  /** spot_reports.user_id — 본인 제보 좋아요 UI 비활성화용 */
  user_id?: string | null;
  /** spot_reports.like_count (마이그레이션 전이면 0) */
  like_count?: number;
}

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

/** 반경 km 원을 덮는 위·경도 범위(도) — PostgREST에서 1차 필터 후 하버사인으로 원 안만 남김 */
function latLngBBoxPadDeg(radiusKm: number, centerLatDeg: number): { dLat: number; dLng: number } {
  const kmPerDeg = 111.32;
  const cosLat = Math.max(0.25, Math.abs(Math.cos((centerLatDeg * Math.PI) / 180)));
  return {
    dLat: radiusKm / kmPerDeg,
    dLng: radiusKm / (kmPerDeg * cosLat),
  };
}

const WINDOW_HOURS = 2;
const REFETCH_MS = 45_000;

/**
 * 최근 2시간·verified 제보만, center 기준 반경 `radiusKm` km 안(하버사인) 거리순.
 * 쿼리에는 위·경도 박스를 걸어 원 밖 행은 가능한 한 제외.
 * 모달이 열려 있을 때만 enabled 권장.
 */
export function useNearbyLivePhotos(
  center: [number, number] | null,
  radiusKm: number,
  enabled: boolean,
  /** 신고 후 목록 즉시 갱신용 — 값이 바뀔 때마다 다시 불러옴 */
  refreshKey = 0,
): NearbyLivePhoto[] {
  const [rows, setRows] = useState<NearbyLivePhoto[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const centerRef = useRef(center);
  centerRef.current = center;

  useEffect(() => {
    if (!enabled || !center) {
      setRows([]);
      return;
    }

    async function load() {
      const sb = getSupabase();
      const c = centerRef.current;
      if (!sb || !c) return;

      const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
      const { dLat, dLng } = latLngBBoxPadDeg(radiusKm, c[0]);
      const { data, error } = await sb
        .from('spot_reports')
        .select(
          'id, photo_url, lat, lng, ai_label, place_name, description, created_at, like_count, user_id',
        )
        .eq('status', 'verified')
        .gte('created_at', since)
        .gte('lat', c[0] - dLat)
        .lte('lat', c[0] + dLat)
        .gte('lng', c[1] - dLng)
        .lte('lng', c[1] + dLng)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error || !data) return;

      const withDist: NearbyLivePhoto[] = (data as Omit<NearbyLivePhoto, 'distKm'>[])
        .map((r) => ({
          ...r,
          like_count: Number((r as { like_count?: number }).like_count) || 0,
          distKm: distKm(c[0], c[1], r.lat, r.lng),
        }))
        .filter((r) => r.distKm <= radiusKm)
        .sort((a, b) => a.distKm - b.distKm);

      setRows(withDist);
    }

    void load();
    timerRef.current = setInterval(() => void load(), REFETCH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, center?.[0], center?.[1], radiusKm, refreshKey]);

  return rows;
}
