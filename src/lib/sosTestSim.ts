import type { SosSignal } from '@/types/sos';
import { SOS_EXPIRE_MINUTES } from '@/types/sos';

/** 관리자 지도 테스트 모드 전용 — DB·피어 시트와 분리 */
export const SOS_TEST_NEARBY_FIRE_ID = 'spotvibe-sim-nearby-fire';

export function isSosTestSimSignal(sig: { id: string }): boolean {
  return sig.id === SOS_TEST_NEARBY_FIRE_ID;
}

/** `sosCenter` 기준 북동쪽 약 수백 m — 화재 유형 마커만 시각 검증용 */
export function buildNearbyFireTestSosSignal(center: [number, number]): SosSignal {
  const cosLat = Math.max(0.32, Math.abs(Math.cos((center[0] * Math.PI) / 180)));
  const dNorthM = 280;
  const dEastM = 130;
  const lat = center[0] + dNorthM / 111_320;
  const lng = center[1] + dEastM / (111_320 * cosLat);
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + SOS_EXPIRE_MINUTES * 60_000).toISOString();
  return {
    id: SOS_TEST_NEARBY_FIRE_ID,
    user_id: '00000000-0000-4000-8000-000000000001',
    signal_type: 'fire',
    lat,
    lng,
    status: 'active',
    note: '[테스트] 지도 테스트 모드 — 근처 화재 시뮬(실제 신호 아님)',
    photo_url: null,
    ai_photo_summary: null,
    responder_id: null,
    responded_at: null,
    expires_at: expiresAt,
    created_at: createdAt,
  };
}
