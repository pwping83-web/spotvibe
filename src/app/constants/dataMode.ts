/**
 * 일반 사용자 지도는 `real`.
 * 관리자만 마이에서 켤 수 있는 미리보기(`test`)는 이 기기·이 계정 세션에만 적용됩니다.
 */

export type SpotVibeDataMode = 'test' | 'real';

const LEGACY_DATA_MODE_KEY = 'spotvibe:dataMode';

/** 예전 전역 `dataMode=test` 저장값을 `real`로 정리 (일반 사용자 혼선 방지) */
export function readInitialDataMode(): SpotVibeDataMode {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LEGACY_DATA_MODE_KEY, 'real');
    } catch {
      /* ignore */
    }
  }
  return 'real';
}

/** 관리자 지도 테스트 미리보기 — 서버가 아닌 로컬에만 저장, 비관리자는 읽지 않음 */
const ADMIN_MAP_TEST_PREVIEW_KEY = 'spotvibe:adminMapTestPreview';

export function readAdminMapTestPreview(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ADMIN_MAP_TEST_PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistAdminMapTestPreview(on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_MAP_TEST_PREVIEW_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
