/**
 * 휴대폰 가로 모드 최소화 — 현재 비활성(항상 false).
 *
 * 비활성 이유:
 *   - interactive-widget=resizes-content 제거 전에는 키보드가 올라올 때
 *     레이아웃 뷰포트 높이가 줄어 (orientation:landscape)+(max-height:480px)
 *     미디어 쿼리가 잘못 일치 → SpotReportUpload 언마운트 → state 초기화
 *   - 세로 고정 모바일 전용 앱이므로 가로 모드 전용 레이아웃 불필요
 *
 * 향후 가로 모드를 지원하려면 아래 주석을 해제하고
 * Sheet 열려있을 때는 false 를 반환하도록 조건 추가할 것.
 */
export function usePhoneLandscapeMapMinimal(): boolean {
  // ── 가로 모드 최소화 비활성 ──
  return false;

  // ── 복구 시 아래 코드 사용 ──
  // const [active, setActive] = useState(false);
  // useEffect(() => {
  //   const q = window.matchMedia('(orientation: landscape) and (max-height: 480px)');
  //   const sync = () => setActive(q.matches);
  //   sync();
  //   q.addEventListener('change', sync);
  //   return () => q.removeEventListener('change', sync);
  // }, []);
  // return active;
}
