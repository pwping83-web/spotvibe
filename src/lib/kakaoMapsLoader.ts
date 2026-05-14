/** 카카오맵 JavaScript API 로드(autoload=false → kakao.maps.load 콜백에서 사용 가능) */

export function leafletZoomToKakaoLevel(leafletZoom: number): number {
  if (!Number.isFinite(leafletZoom)) return 8;
  return Math.max(4, Math.min(11, Math.round(22 - leafletZoom)));
}

export function kakaoLevelToLeafletZoom(level: number): number {
  if (!Number.isFinite(level)) return 14;
  return Math.max(11, Math.min(18, Math.round(22 - level)));
}

export function loadKakaoMapsScript(appKey: string): Promise<void> {
  if (window.kakao?.maps?.load) {
    return new Promise((resolve) => {
      window.kakao.maps.load(() => resolve());
    });
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-spotvibe-kakao-maps="1"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      const done = () => {
        if (window.kakao?.maps?.load) window.kakao.maps.load(() => resolve());
        else reject(new Error('Kakao Maps SDK not available after script load'));
      };
      if (existing.dataset.loaded === '1') {
        done();
        return;
      }
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', () => reject(new Error('Kakao Maps script load error')), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.spotvibeKakaoMaps = '1';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.onload = () => {
      script.dataset.loaded = '1';
      if (!window.kakao?.maps?.load) {
        reject(new Error('Kakao Maps SDK global missing'));
        return;
      }
      window.kakao.maps.load(() => resolve());
    };
    script.onerror = () => reject(new Error('Kakao Maps script network error'));
    document.head.appendChild(script);
  });
}
