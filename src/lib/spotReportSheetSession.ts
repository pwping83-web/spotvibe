/**
 * 현장 제보 시트 — 모바일에서 컴포넌트 리마운트·뷰포트 급변 시에도
 * X로 닫기 전까지 열림 상태를 유지하기 위한 세션 플래그.
 */
export let spotReportSheetSessionOpen = false;

export function setSpotReportSheetSessionOpen(open: boolean): void {
  spotReportSheetSessionOpen = open;
}

export function isCoarsePointerDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches ||
    window.innerWidth < 640
  );
}
