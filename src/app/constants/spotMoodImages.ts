/**
 * 알림·AI 카드용 “사람 많은 현장” 무드 이미지 (Unsplash, UI 데모용).
 * 운영 시 CDN/자산으로 교체·출처 표기 권장.
 */
export const SPOT_MOOD_IMAGES = {
  /** 버스킹·거리 공연 — 콘서트 관중 인파 */
  busking:
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80',
  /** 한강·야외 공원 — 낮 피크타임 공원 군중 */
  hanRiver:
    'https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?auto=format&fit=crop&w=900&q=80',
  /** 팝업·상권 밀집 — 번화가 군중 */
  retailCrowd:
    'https://images.unsplash.com/photo-1523301343968-6a6ebf63c672?auto=format&fit=crop&w=900&q=80',
  /** 저녁·바·라운지 — 클럽가 인파 (UI용 키명) */
  nightlife:
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80',
  /** 러닝·야외 스포츠 — 마라톤/러닝 크루 인파 */
  outdoorActive:
    'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=900&q=80',
  /** 푸드·야외 페스티벌 인파 */
  foodFest:
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80',
  /** 마포 한강 — 강변 피크닉·인파 */
  mapoHangangPark:
    'https://images.unsplash.com/photo-1427751840561-9852520f8ce8?auto=format&fit=crop&w=900&q=80',
} as const;

export type MoodImageKey = keyof typeof SPOT_MOOD_IMAGES;

/** 네이버 지도 웹 검색 — 이후 앱 딥링크·좌표 기반 길찾기 API로 교체 */
export function naverMapSearchUrl(query: string): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(query)}`;
}
