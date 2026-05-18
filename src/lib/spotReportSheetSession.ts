/**
 * 현장 제보 시트 — 모바일에서 컴포넌트 리마운트·뷰포트 급변 시에도
 * X로 닫기 전까지 열림 상태·폼 데이터를 유지하기 위한 세션 모듈.
 *
 * File 객체는 직렬화 불가 → 모듈 변수에 직접 보존.
 */

// ── 시트 열림 상태 ──
export let spotReportSheetSessionOpen = false;

export function setSpotReportSheetSessionOpen(open: boolean): void {
  spotReportSheetSessionOpen = open;
  if (!open) clearSpotReportSheetDraft();
}

// ── 폼 draft (재마운트 후 복원용) ──
export interface SpotReportDraft {
  file: File | null;
  previewUrl: string | null;
  placeName: string;
  description: string;
  pickSource: 'camera' | 'file' | null;
  legalAck: boolean;
}

let _draft: SpotReportDraft = {
  file: null,
  previewUrl: null,
  placeName: '',
  description: '',
  pickSource: null,
  legalAck: false,
};

export function getSpotReportDraft(): SpotReportDraft {
  return _draft;
}

export function setSpotReportDraft(patch: Partial<SpotReportDraft>): void {
  _draft = { ..._draft, ...patch };
}

export function clearSpotReportSheetDraft(): void {
  if (_draft.previewUrl?.startsWith('blob:')) {
    try { URL.revokeObjectURL(_draft.previewUrl); } catch { /* ignore */ }
  }
  _draft = { file: null, previewUrl: null, placeName: '', description: '', pickSource: null, legalAck: false };
}

// ── 기기 감지 ──
export function isCoarsePointerDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches ||
    window.innerWidth < 640
  );
}
