export {};

type KakaoLatLng = { getLat(): number; getLng(): number };

export type KakaoMapInstance = {
  setCenter(latlng: KakaoLatLng): void;
  getCenter(): KakaoLatLng;
  setLevel(level: number, options?: { animate?: boolean }): void;
  getLevel(): number;
  relayout(): void;
  setMinLevel(minLevel: number): void;
  setMaxLevel(maxLevel: number): void;
};

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (cb: () => void) => void;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        Map: new (
          container: HTMLElement,
          options: { center: KakaoLatLng; level?: number },
        ) => KakaoMapInstance;
        event: {
          addListener(target: KakaoMapInstance, type: string, handler: () => void): void;
          removeListener(target: KakaoMapInstance, type: string, handler: () => void): void;
        };
      };
    };
  }
}
