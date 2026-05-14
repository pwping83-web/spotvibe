/**
 * 최근 위치를 쓴 활성 사용자 수(추정)에 따라 `profiles` 위치 기록 주기(ms)를 정한다.
 * - 약 2명 이하: ~실시간(1.2s)
 * - 1천 명 근처: 5초
 * - 1만 명 이상: 30초(상한)
 */
export function adaptiveLocationWriteIntervalMs(activeSharersApprox: number): number {
  const n = Math.max(1, Math.floor(activeSharersApprox));
  if (n <= 2) return 1_200;
  if (n >= 10_000) return 30_000;
  if (n <= 1_000) {
    const t = (n - 2) / (1_000 - 2);
    return Math.round(1_200 + t * (5_000 - 1_200));
  }
  const t = (n - 1_000) / (10_000 - 1_000);
  return Math.round(5_000 + t * (30_000 - 5_000));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 근처 목록 REST 재조회 주기(Realtime 미수신·누락 대비).
 * 소규모에서는 쓰기 주기에 가깝게 짧게(최소 4초), 사용자 수가 늘수록 완만히 늘림.
 */
export function adaptivePeerRefetchIntervalMs(activeSharersApprox: number): number {
  const w = adaptiveLocationWriteIntervalMs(activeSharersApprox);
  const n = Math.max(1, Math.floor(activeSharersApprox));
  // 배수: 적을수록 촘촘(상대 점이 빨리 따라가 보이게), 많을수록 서버 부담 완화
  const mult = n <= 2 ? 2 : n <= 100 ? 2.25 : n <= 1_000 ? 2.5 : 3;
  const raw = Math.round(w * mult);
  return clamp(raw, 4_000, 120_000);
}
