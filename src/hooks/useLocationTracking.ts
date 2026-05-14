import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { ADMIN_MAP_TEST_VIRTUAL_LAT_LNG } from '@/app/constants/adminTestGeo';

function isValidGeo(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

interface Options {
  userId: string | null;
  /** 'my_location' 모드일 때만 실제 GPS 추적 */
  locationMode: 'my_location' | 'explore';
  enabled: boolean;
  /** 관리자 테스트 지도: GPS 대신 고정 가상 좌표만 기록 */
  adminMapTestVirtual?: boolean;
  /** 활성 사용자 수에 따른 DB 동기화 주기(ms) — `useActiveLocationLoadScale` */
  writeIntervalMs: number;
}

const MIN_LOCATION_PUSH_INTERVAL_MS = 10_000;
const MIN_LOCATION_PUSH_MOVE_METERS = 25;

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toR = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLng = toR(b[1] - a[1]);
  const lat1 = toR(a[0]);
  const lat2 = toR(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 내 위치를 Supabase `profiles`에 반영한다.
 * - 일반: `watchPosition`으로 좌표를 받고 `writeIntervalMs`마다 DB 동기화 → 상대 Realtime
 * - admin 가상: 고정 좌표를 같은 주기로 기록
 * - `profiles.updated_at` 트리거로 최근 활동 유지
 *
 * @returns lastKnown — 마지막으로 DB에 반영한 좌표(근처 사용자 쿼리 중심에 사용)
 */
export function useLocationTracking({
  userId,
  locationMode,
  enabled,
  adminMapTestVirtual = false,
  writeIntervalMs,
}: Options): { lastKnown: [number, number] | null } {
  const [lastKnown, setLastKnown] = useState<[number, number] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      setLastKnown(null);
    }
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId || locationMode !== 'my_location') {
      return;
    }

    if (adminMapTestVirtual) {
      async function tick() {
        const lat = ADMIN_MAP_TEST_VIRTUAL_LAT_LNG.lat;
        const lng = ADMIN_MAP_TEST_VIRTUAL_LAT_LNG.lng;
        const sb = getSupabase();
        if (!sb || !userId) return;
        const { error } = await sb
          .from('profiles')
          .update({ explore_lat: lat, explore_lng: lng })
          .eq('id', userId);
        if (error) console.warn('[useLocationTracking] profiles update:', error.message);
        else setLastKnown([lat, lng]);
      }
      void tick();
      timerRef.current = setInterval(() => void tick(), writeIntervalMs);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }

    if (!navigator.geolocation) return;

    const sb = getSupabase();
    if (!sb) return;

    let cancelled = false;
    let lastCoords: { lat: number; lng: number } | null = null;
    let inFlight = false;
    let lastPushedAtMs = 0;
    let lastPushedCoords: [number, number] | null = null;

    async function pushDb() {
      if (cancelled || !lastCoords || inFlight) return;
      const { lat, lng } = lastCoords;
      if (!isValidGeo(lat, lng)) return;
      const now = Date.now();
      if (now - lastPushedAtMs < MIN_LOCATION_PUSH_INTERVAL_MS) return;
      if (
        lastPushedCoords &&
        haversineMeters(lastPushedCoords, [lat, lng]) < MIN_LOCATION_PUSH_MOVE_METERS
      ) {
        return;
      }
      inFlight = true;
      const { error } = await sb
        .from('profiles')
        .update({ explore_lat: lat, explore_lng: lng })
        .eq('id', userId);
      inFlight = false;
      if (error) {
        console.warn('[useLocationTracking] profiles update:', error.message);
      } else if (!cancelled) {
        lastPushedAtMs = now;
        lastPushedCoords = [lat, lng];
        setLastKnown([lat, lng]);
      }
    }

    const safeWriteIntervalMs = Math.max(writeIntervalMs, MIN_LOCATION_PUSH_INTERVAL_MS);
    const intervalId = window.setInterval(() => void pushDb(), safeWriteIntervalMs);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      },
      () => {
        /* 권한·일시 오류는 조용히 무시 */
      },
      {
        enableHighAccuracy: true,
        maximumAge: 500,
        timeout: 20_000,
      },
    );

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        void pushDb();
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [userId, locationMode, enabled, adminMapTestVirtual, writeIntervalMs]);

  return { lastKnown };
}
