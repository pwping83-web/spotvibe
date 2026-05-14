/**
 * 관리자「테스트 지도」ON 시 실제 GPS 대신 쓰는 가상 위치.
 * 경기 안양시 동안구 관평로385번길 35 (WGS84 근사)
 */
export const ADMIN_MAP_TEST_VIRTUAL_ADDRESS = '경기 안양시 동안구 관평로385번길 35';

export const ADMIN_MAP_TEST_VIRTUAL_LAT_LNG = { lat: 37.391605, lng: 126.966762 } as const;

export const ADMIN_MAP_TEST_VIRTUAL_CENTER: [number, number] = [
  ADMIN_MAP_TEST_VIRTUAL_LAT_LNG.lat,
  ADMIN_MAP_TEST_VIRTUAL_LAT_LNG.lng,
];
