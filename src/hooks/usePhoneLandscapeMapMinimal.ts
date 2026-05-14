import { useEffect, useState } from 'react';

/**
 * 휴대폰 가로 모드처럼 뷰포트 높이가 짧은 가로 화면.
 * 노트북 가로(높이 보통 600px+)는 제외해 지도만 보는 모드가 켜지지 않게 함.
 */
export function usePhoneLandscapeMapMinimal() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const q = window.matchMedia('(orientation: landscape) and (max-height: 480px)');
    const sync = () => setActive(q.matches);
    sync();
    q.addEventListener('change', sync);
    return () => q.removeEventListener('change', sync);
  }, []);

  return active;
}
