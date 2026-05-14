import type { ExploreRegionPreset } from '@/app/constants/exploreRegions';

/** 마이「자주 찾는 위치」— 즐겨찾기처럼 지도 탐색 중심만 저장 (기기 로컬) */
export type SavedExplorePlace = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

const STORAGE_KEY = 'spotvibe-saved-explore-places-v1';
export const SAVED_EXPLORE_PLACES_MAX = 14;

function isValidSaved(x: unknown): x is SavedExplorePlace {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.label === 'string' &&
    typeof o.lat === 'number' &&
    Number.isFinite(o.lat) &&
    typeof o.lng === 'number' &&
    Number.isFinite(o.lng)
  );
}

export function loadSavedExplorePlaces(): SavedExplorePlace[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSaved);
  } catch {
    return [];
  }
}

export function persistSavedExplorePlaces(places: SavedExplorePlace[]) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = places.slice(0, SAVED_EXPLORE_PLACES_MAX);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota 등 */
  }
}

export function savedPlaceToPreset(s: SavedExplorePlace): ExploreRegionPreset {
  return { id: s.id, label: s.label, center: [s.lat, s.lng] };
}
