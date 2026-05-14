import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import {
  profileMatchesPeekFilters,
  type ProfilePeekMatchRow,
} from '@/app/lib/peekMatchFilters';

export interface MatchedUser {
  id: string;
  /** 위치 노이즈 처리된 좌표 (~30–80m — 사용자 id 기반 고정 오프셋, 갱신마다 튀지 않음) */
  lat: number;
  lng: number;
  ageRange: string | null;
  gender: string | null;
  /** 내 필터와 겹치는 조건 수 (높을수록 더 강조) */
  matchScore: number;
}

interface MatchFilters {
  center: [number, number];
  /** km 반경 */
  radiusKm: number;
  activityTags: Set<string>;
  mbtiSet: Set<string>;
  bloodTypeSet: Set<string>;
  genderPref: 'all' | 'female_crowd' | 'male_crowd';
  /** 연령대 필터 — 복수 선택, empty = 상관없음 */
  ageRangeSet: Set<string>;
  /** 자신의 userId — 자신은 결과에서 제외 */
  myUserId: string | null;
  enabled: boolean;
  /**
   * true면 `profiles.location_mode === 'my_location'` 만 (주기적 GPS 갱신 중인 사용자).
   * 부스트 꺼짐·일시중지 시 근처 «실시간 추적» 인원만 넓게 보여 줄 때 사용.
   */
  onlyLiveLocationMode?: boolean;
  /** 활성 사용자 수에 따른 bbox 전체 재조회 주기(ms) — `useActiveLocationLoadScale` */
  refetchIntervalMs: number;
}

const STALE_MINUTES = 5; // 5분 이상 미갱신 사용자는 지도에서 제거
const MAP_SESSION_REFETCH_MS = 30_000;

const LAT_JITTER = 0.0007; // ~78m
const LNG_JITTER = 0.001; // ~80m

type ProfileLocationRow = ProfilePeekMatchRow & {
  id: string;
  explore_lat: number | null;
  explore_lng: number | null;
  updated_at?: string | null;
  location_mode?: string | null;
};

function bboxDeltas(center: [number, number], radiusKm: number) {
  const latDelta = radiusKm / 111;
  const cosLat = Math.cos((center[0] * Math.PI) / 180);
  const lngDelta = radiusKm / (111 * Math.max(cosLat, 0.01));
  return { latDelta, lngDelta };
}

function inBbox(lat: number, lng: number, center: [number, number], radiusKm: number): boolean {
  const { latDelta, lngDelta } = bboxDeltas(center, radiusKm);
  return (
    lat >= center[0] - latDelta &&
    lat <= center[0] + latDelta &&
    lng >= center[1] - lngDelta &&
    lng <= center[1] + lngDelta
  );
}

/** 동일 사용자는 항상 같은 오프셋 — 재조회해도 핀이 제자리에서 랜덤 점프하지 않음 */
function stableJitteredLatLng(id: string, lat: number, lng: number): { lat: number; lng: number } {
  let h = 2_166_136_261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 1_677_7619);
  }
  const u1 = ((h >>> 0) & 0xffff) / 0xffff;
  const u2 = ((Math.imul(h, 7919) >>> 0) & 0xffff) / 0xffff;
  return {
    lat: lat + (u1 - 0.5) * LAT_JITTER,
    lng: lng + (u2 - 0.5) * LNG_JITTER,
  };
}

function matchScoreFromRow(
  row: ProfileLocationRow,
  activityTags: Set<string>,
  mbtiSet: Set<string>,
  bloodTypeSet: Set<string>,
): number {
  let score = 0;
  if (activityTags.size > 0) {
    const rowTags: string[] = row.activity_tags ?? [];
    score += rowTags.filter((t) => activityTags.has(t)).length * 3;
  }
  if (mbtiSet.size > 0) {
    const rowMbti: string[] = row.mbti_types ?? [];
    score += rowMbti.filter((m) => mbtiSet.has(m)).length * 2;
  }
  if (bloodTypeSet.size > 0) {
    const rowBlood: string[] = row.blood_types ?? [];
    score += rowBlood.filter((b) => bloodTypeSet.has(b)).length * 2;
  }
  return score;
}

/** fetch·Realtime 공통 — 조건에 맞으면 MatchedUser, 아니면 null */
function buildMatchedUser(
  row: ProfileLocationRow,
  f: MatchFilters,
  staleCutoffMs: number,
): MatchedUser | null {
  const id = String(row.id);
  if (f.myUserId && id === f.myUserId) return null;

  const lat0 = row.explore_lat;
  const lng0 = row.explore_lng;
  if (
    typeof lat0 !== 'number' ||
    typeof lng0 !== 'number' ||
    !Number.isFinite(lat0) ||
    !Number.isFinite(lng0)
  ) {
    return null;
  }

  const t = row.updated_at ? new Date(String(row.updated_at)).getTime() : 0;
  if (t < staleCutoffMs) return null;

  if (!inBbox(lat0, lng0, f.center, f.radiusKm)) return null;

  if (f.onlyLiveLocationMode && row.location_mode !== 'my_location') return null;

  const filterInput = {
    activityTags: f.activityTags,
    mbtiSet: f.mbtiSet,
    bloodTypeSet: f.bloodTypeSet,
    genderPref: f.genderPref,
    ageRangeSet: f.ageRangeSet,
  };

  if (!profileMatchesPeekFilters(row, filterInput)) return null;

  const score = matchScoreFromRow(row, f.activityTags, f.mbtiSet, f.bloodTypeSet);
  const j = stableJitteredLatLng(id, lat0, lng0);
  return {
    id,
    lat: j.lat,
    lng: j.lng,
    ageRange: row.age_range ?? null,
    gender: row.gender ?? null,
    matchScore: score,
  };
}

/**
 * Supabase profiles 에서 조건에 맞는 다른 사용자를 가져와 지도 점으로 반환한다.
 *
 * - 초기·주기: bbox REST 조회
 * - Realtime: `profiles` INSERT/UPDATE/DELETE 시 즉시 목록 반영(퍼블리케이션에 테이블 추가 필요)
 * - 위치는 id 기반 고정 오프셋(~80m, 프라이버시)
 */
export function useMatchedUsers(filters: MatchFilters): MatchedUser[] {
  const [users, setUsers] = useState<MatchedUser[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (!filters.enabled) {
      setUsers([]);
      return;
    }

    let cancelled = false;
    let inFlight = false;
    const sb = getSupabase();

    async function fetchAll() {
      const f = filtersRef.current;
      if (!sb || cancelled || inFlight) return;
      inFlight = true;

      const {
        center,
        radiusKm,
        myUserId,
        onlyLiveLocationMode = false,
      } = f;
      const { latDelta, lngDelta } = bboxDeltas(center, radiusKm);
      const staleCutoffMs = Date.now() - STALE_MINUTES * 60_000;

      const baseSelect =
        'id, explore_lat, explore_lng, age_range, gender, activity_tags, mbti_types, blood_types, gender_crowd_pref, updated_at, location_mode';

      let q = sb
        .from('profiles')
        .select(baseSelect)
        .not('explore_lat', 'is', null)
        .not('explore_lng', 'is', null)
        .gte('explore_lat', center[0] - latDelta)
        .lte('explore_lat', center[0] + latDelta)
        .gte('explore_lng', center[1] - lngDelta)
        .lte('explore_lng', center[1] + lngDelta)
        .order('updated_at', { ascending: false })
        .limit(200);

      if (onlyLiveLocationMode) q = q.eq('location_mode', 'my_location');
      if (myUserId) q = q.neq('id', myUserId);

      const { data: rawRows, error } = await q;
      inFlight = false;
      if (cancelled) return;
      if (error) {
        console.warn('useMatchedUsers fetch:', error.message);
        return;
      }
      if (!rawRows?.length) {
        setUsers([]);
        return;
      }

      const result: MatchedUser[] = [];
      for (const row of rawRows) {
        const u = buildMatchedUser(row as ProfileLocationRow, f, staleCutoffMs);
        if (u) result.push(u);
      }
      setUsers(result);
    }

    void fetchAll();
    const refetchMs = MAP_SESSION_REFETCH_MS;
    timerRef.current = setInterval(() => void fetchAll(), refetchMs);

    if (!sb) {
      return () => {
        cancelled = true;
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }

    const channel = sb
      .channel('profiles-nearby-peers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const f = filtersRef.current;
          if (!f.enabled) return;

          const staleCutoffMs = Date.now() - STALE_MINUTES * 60_000;

          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string } | null;
            const rid = oldRow?.id != null ? String(oldRow.id) : null;
            if (rid) setUsers((prev) => prev.filter((u) => u.id !== rid));
            return;
          }

          const row = payload.new as ProfileLocationRow | null;
          if (!row?.id) return;

          const id = String(row.id);
          const nextUser = buildMatchedUser(row, f, staleCutoffMs);

          setUsers((prev) => {
            if (!nextUser) {
              return prev.filter((u) => u.id !== id);
            }
            const idx = prev.findIndex((u) => u.id === id);
            if (idx === -1) return [...prev, nextUser];
            const copy = prev.slice();
            copy[idx] = nextUser;
            return copy;
          });
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('useMatchedUsers realtime:', err?.message ?? status);
        }
      });

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      void sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.enabled,
    filters.center[0],
    filters.center[1],
    filters.radiusKm,
    Array.from(filters.activityTags).sort().join(','),
    Array.from(filters.mbtiSet).sort().join(','),
    Array.from(filters.bloodTypeSet).sort().join(','),
    filters.genderPref,
    Array.from(filters.ageRangeSet).sort().join(','),
    filters.myUserId,
    filters.onlyLiveLocationMode,
  ]);

  return users;
}
