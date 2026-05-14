import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Crosshair,
  Loader2,
  MapPinned,
  Sparkles,
  X,
  ChevronRight,
  ChevronDown,
  Clock,
  Navigation,
  Images,
  Search,
  Info,
} from 'lucide-react';
import { SpotReportUpload } from './SpotReportUpload';
import { ExploreRegionFlowPanel } from './ExploreRegionFlowPanel';
import { NearbyLivePhotosModal } from './NearbyLivePhotosModal';
import { DisabledHelperSheet } from './DisabledHelperSheet';
import { FireExtinguisherSheet } from './FireExtinguisherSheet';
import { ToiletSheet, TOILET_MAP_ICON } from './ToiletSheet';
import { TrashBinSheet, PUBLIC_TRASH_MAP_ICON } from './TrashBinSheet';
import { SmokingRoomSheet, SMOKING_ROOM_MAP_ICON } from './SmokingRoomSheet';
import { MarkerPhotoSheet, type MarkerItem } from './MarkerPhotoSheet';
import { FacilityCategorySheet, OUTDOOR_GYM_MAP_ICON } from './FacilityCategorySheet';
import { NEARBY_LIVE_PHOTOS_RADIUS_KM } from '@/hooks/useNearbyLivePhotos';
import { AnimatePresence, motion } from 'motion/react';
import {
  aiInsightPresetIdsForAnchorPreset,
  DEFAULT_EXPLORE_CENTER,
  EXPLORE_REGION_PRESETS,
  explorePickRouteInfo,
  matchExploreRegionPresets,
  type ExploreRegionPreset,
} from '@/app/constants/exploreRegions';
import type { SpotVibeDataMode } from '@/app/constants/dataMode';
import {
  ADMIN_MAP_TEST_VIRTUAL_CENTER,
  ADMIN_MAP_TEST_VIRTUAL_LAT_LNG,
} from '@/app/constants/adminTestGeo';
import {
  crowdDotColorForGenderPref,
  getAgeGenderColors,
  mapBracketPalette,
} from '@/app/constants/ageGenderColors';
import type { MatchedUser } from '@/hooks/useMatchedUsers';
import { cn } from '@/app/components/ui/utils';
import { LocationRealtimeInfoBlock } from '@/app/components/LocationRealtimeInfoBlock';
import type { SosSignal, SosTypeMeta } from '@/types/sos';
import { getSosTypeMeta, sosOpacity } from '@/types/sos';
import { haversineMeters } from '@/lib/geoDistance';
import { ViNeighborSendSheet } from './ViNeighborSendSheet';

/** 취약계층 마커 근접 시 이웃 단말 짧은 알림음(웹 오디오) */
function playViProximityAlertTone() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.11, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.22);
    void ctx.resume().catch(() => {});
  } catch {
    /* noop */
  }
}

/**
 * 내 위치: 현재는 브라우저 Geolocation + Leaflet.
 * TODO(Kakao): Kakao Maps SDK / kakao.maps.services.Geocoder 등으로 교체·정확도·백그라운드 정책 맞추기.
 */

interface MapAreaProps {
  onClusterClick: () => void;
  onExplorePicked?: () => void;
  /** test=가상 인구·데모 추천, real=실측 연동 전(시뮬·데모 끔) */
  dataMode?: SpotVibeDataMode;
  /** 마이 프로필 연령 — 인파 안개·탐색 중심 링·점 색과 연동 */
  profileAgeRange?: string;
  /** 실제 모드: 근처 다른 이용자 점(3.0 제출 빌드에서는 비표시) */
  matchedUsers?: MatchedUser[];
  mbtiSet?: Set<string>;
  bloodTypeSet?: Set<string>;
  genderPref?: 'all' | 'female_crowd' | 'male_crowd';
  activityTags?: Set<string>;
  /** 탐색 중심(마이·지도 공통). 지도 탭이 꺼졌다 켜져도 유지 */
  exploreAnchor?: [number, number];
  /** 값이 오를 때마다 exploreAnchor로 맞추고 fly */
  exploreJumpSeq?: number;
  /** 지도 탭·프리셋에서 중심이 바뀌면 부모에 동기화 */
  onExploreAnchorCommit?: (c: [number, number]) => void;
  /** 「위치 변경」으로 지도를 찍은 뒤 경로 시트를 열 때 (네이버 검색어·표시 라벨) */
  onOpenRouteSheetTo?: (naverQuery: string, displayLabel: string) => void;
  /** 현장 제보 완료 후 프로필 포인트 등 재조회 */
  onReportSubmitted?: () => void;
  /** 실제 모드 + 로그인 시 주변 실시간 제보 모달 진입 버튼 */
  livePhotoFeedEnabled?: boolean;
  /** 현장 제보: 관리자 전용(파일 선택·좌표 완화) */
  isAdmin?: boolean;
  /**
   * 「내 위치 찾기」로 실시간 추적이 켜졌는지(테스트 지도면 가상 위치도 공유로 간주).
   * 부모에서 다른 사람 점·프로필 위치 갱신을 이 플래그와 묶음.
   */
  onMapLocationShareActiveChange?: (active: boolean) => void;
  /** 마이·지역 선택과 동기. explore일 때 실시간 사진은 GPS가 아니라 지도 탐색 중심 기준 */
  locationMode?: 'my_location' | 'explore';
  /** 휴대폰 가로 등: 플로팅 버튼·검색·제보 FAB 숨기고 지도만 */
  mapMinimalChrome?: boolean;
  /** SOS 도움 신호 목록 — useSosSignals에서 전달 */
  sosSignals?: SosSignal[];
  /** 내 활성 SOS 신호 ID — 있으면 버튼을 "해제" 상태로 표시 */
  myActiveSosSignalId?: string | null;
  /** SOS 시트 열기 */
  onSosOpen?: () => void;
  /** 지도에서 타인 SOS 마커 탭 — 유형·메모 확인 */
  onSosPeerSelect?: (sig: SosSignal) => void;
  /**
   * 지도에 표시 중인 내 좌표(브라우저 GPS·10분 홀드 포함).
   * DB 동기화와 무관하게 SOS 발신 좌표를 App과 맞추기 위해 사용.
   */
  onMapClientMyLocationChange?: (coords: { lat: number; lng: number } | null) => void;
  /** 지도 화면이 실제 활성 상태인지(tab visible + foreground) */
  isActive?: boolean;
  /** 로그인 사용자 — 이웃 도움 메시지 전송 시 수신자 조회 */
  userId?: string | null;
  /** false면 관리자 테스트 지도 등으로 Supabase 쓰기 비활성 */
  mapServerEnabled?: boolean;
}

/** 활동 태그 → 지도 오버레이 */
const ACTIVITY_OVERLAY: Record<string, {
  color: string;
  offset: [number, number];
  radiusM: number;
}> = {
  운동:   { color: '#00F0FF', offset: [ 0.004, -0.003], radiusM: 250 },
  수다:   { color: '#FF6B6B', offset: [-0.003,  0.004], radiusM: 190 },
  산책:   { color: '#4ADE80', offset: [ 0.005,  0.003], radiusM: 310 },
  야외:   { color: '#FFDE00', offset: [-0.002, -0.005], radiusM: 280 },
  소풍:   { color: '#FB923C', offset: [ 0.003,  0.006], radiusM: 260 },
  공연:   { color: '#FF6B6B', offset: [-0.005, -0.001], radiusM: 220 },
  맛집:   { color: '#FB923C', offset: [ 0.001, -0.006], radiusM: 195 },
  쇼핑:   { color: '#FFDE00', offset: [-0.004,  0.002], radiusM: 210 },
  클럽:   { color: '#A855F7', offset: [ 0.006, -0.004], radiusM: 175 },
  카페:   { color: '#D97706', offset: [-0.001,  0.006], radiusM: 185 },
  전시:   { color: '#00F0FF', offset: [ 0.007,  0.002], radiusM: 165 },
  야경:   { color: '#A855F7', offset: [-0.003, -0.007], radiusM: 200 },
};

/** MBTI → 지도 오버레이 데이터 매핑 */
/** 혈액형 → 지도 오버레이 */
const BLOOD_TYPE_OVERLAY: Record<string, {
  label: string;
  color: string;
  /** exploreCenter 기준 오프셋 */
  offset: [number, number];
  radiusM: number;
  /** 이 혈액형과 친화성 높은 활동 태그 */
  affinityTags: string[];
}> = {
  A:  { label: 'A형',  color: '#FF6B6B', offset: [ 0.004,  0.002], radiusM: 300, affinityTags: ['전시', '카페', '야경', '소풍'] },
  B:  { label: 'B형',  color: '#FFDE00', offset: [-0.003,  0.004], radiusM: 310, affinityTags: ['운동', '야외', '클럽', '공연'] },
  O:  { label: 'O형',  color: '#00F0FF', offset: [-0.004, -0.003], radiusM: 290, affinityTags: ['수다', '공연', '소풍', '맛집'] },
  AB: { label: 'AB형', color: '#A855F7', offset: [ 0.003, -0.004], radiusM: 270, affinityTags: ['전시', '맛집', '카페', '쇼핑'] },
};

const MBTI_OVERLAY: Record<string, {
  label: string;
  color: string;
  /** exploreCenter 기준 오프셋 */
  offset: [number, number];
  radiusM: number;
}> = {
  ENFP: { label: 'ENFP', color: '#FFDE00', offset: [0.003,  0.004],  radiusM: 320 },
  ENFJ: { label: 'ENFJ', color: '#FFDE00', offset: [0.004, -0.003],  radiusM: 280 },
  ENTP: { label: 'ENTP', color: '#00F0FF', offset: [-0.002, 0.005],  radiusM: 300 },
  ENTJ: { label: 'ENTJ', color: '#00F0FF', offset: [0.005,  0.001],  radiusM: 260 },
  ESFP: { label: 'ESFP', color: '#FF6B6B', offset: [0.002,  0.003],  radiusM: 310 },
  ESFJ: { label: 'ESFJ', color: '#FF6B6B', offset: [-0.003, 0.003],  radiusM: 290 },
  ESTP: { label: 'ESTP', color: '#FFDE00', offset: [0.001, -0.004],  radiusM: 340 },
  ESTJ: { label: 'ESTJ', color: '#00F0FF', offset: [-0.004, -0.002], radiusM: 270 },
  INFP: { label: 'INFP', color: '#FF6B6B', offset: [-0.005, 0.001],  radiusM: 250 },
  INFJ: { label: 'INFJ', color: '#FF6B6B', offset: [-0.004, -0.004], radiusM: 230 },
  INTP: { label: 'INTP', color: '#00F0FF', offset: [0.003, -0.005],  radiusM: 260 },
  INTJ: { label: 'INTJ', color: '#00F0FF', offset: [-0.006, 0.002],  radiusM: 240 },
  ISFP: { label: 'ISFP', color: '#FFDE00', offset: [0.002,  0.006],  radiusM: 270 },
  ISFJ: { label: 'ISFJ', color: '#FFDE00', offset: [-0.002, -0.005], radiusM: 255 },
  ISTP: { label: 'ISTP', color: '#FF6B6B', offset: [0.006, -0.001],  radiusM: 280 },
  ISTJ: { label: 'ISTJ', color: '#FF6B6B', offset: [-0.001, -0.006], radiusM: 240 },
};

/** CartoDB Dark Matter — OSM data, no API key */
const TILE_DARK_MATTER =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** 지도 연령층(20·30·40대) — 마이와 동일 팔레트 */
const M20 = mapBracketPalette('20대');
const M30 = mapBracketPalette('30대');
const M40 = mapBracketPalette('40대');

const INITIAL_CENTER: [number, number] = DEFAULT_EXPLORE_CENTER;
const INITIAL_ZOOM = 14;

/** 40대+ 밀집 “클러스터” — 기본 지도 기준 오프셋(탐색 중심 이동 시 같이 이동) */
const CLUSTER_OFFSET_FROM_INITIAL: [number, number] = [
  37.55455 - INITIAL_CENTER[0],
  126.92405 - INITIAL_CENTER[1],
];

/**
 * 혈액형·MBTI·활동 태그를 고를수록 테스트 지도의 가상 반경 축소 (축마다 곱함, 전부 비면 1)
 */
function crowdFilterTightness(
  bloodTypeSet?: Set<string>,
  mbtiSet?: Set<string>,
  activityTags?: Set<string>,
): number {
  const nb = bloodTypeSet?.size ?? 0;
  const nm = mbtiSet?.size ?? 0;
  const na = activityTags?.size ?? 0;
  if (nb === 0 && nm === 0 && na === 0) return 1;

  let f = 1;
  if (nb > 0) f *= Math.max(0.34, 0.9 - nb * 0.14);
  if (nm > 0) f *= Math.max(0.4, 0.93 - nm * 0.055);
  if (na > 0) f *= Math.max(0.35, 0.9 - na * 0.045);

  return Math.max(0.16, f);
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Geolocation / Leaflet용 위·경도 유효성 */
function isValidGeoLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** 스트리밍이 끊긴 뒤에도 마지막 GPS 지점 마커를 유지하는 시간 */
const LAST_KNOWN_MARKER_HOLD_MS = 10 * 60 * 1000;
/** watch 실패 후 재수신 시도 주기 */
const GPS_RECONNECT_INTERVAL_MS = 30 * 1000;

/** 균일 원판 위에 가상 좌표 분포 (재현 가능한 PRNG) */
function randomPointsInDisk(
  centerLat: number,
  centerLng: number,
  count: number,
  seed: number,
  maxRadiusKm: number,
): [number, number][] {
  const rnd = mulberry32(seed);
  const rLat = maxRadiusKm / 111;
  const cosLat = Math.max(1e-6, Math.abs(Math.cos((centerLat * Math.PI) / 180)));
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const angle = rnd() * Math.PI * 2;
    const t = Math.sqrt(rnd());
    const dLat = rLat * t * Math.cos(angle);
    const dLng = ((rLat * t * Math.sin(angle)) / cosLat);
    out.push([centerLat + dLat, centerLng + dLng]);
  }
  return out;
}

function metersToLatLngDelta(dNorthM: number, dEastM: number, lat: number): [number, number] {
  const cosLat = Math.max(0.32, Math.abs(Math.cos((lat * Math.PI) / 180)));
  return [dNorthM / 111_320, dEastM / (111_320 * cosLat)];
}

function clampDeltaMeters(delta: [number, number], lat: number, maxM: number): [number, number] {
  const cosLat = Math.max(0.32, Math.abs(Math.cos((lat * Math.PI) / 180)));
  const mN = delta[0] * 111_320;
  const mE = delta[1] * 111_320 * cosLat;
  const h = Math.hypot(mN, mE);
  if (h <= maxM || h < 1e-12) return delta;
  const s = maxM / h;
  return [delta[0] * s, delta[1] * s];
}

/**
 * 테스트 모드 가상 인구 — 4명 스쿼드 단위(정지·관람·조깅·보행·소수 빠른 이동=차·바이크 느낌·개별 서성).
 * 미터 단위 클램프(건물 데이터 없음).
 */
function virtualCrowdMotionDelta(
  index: number,
  layerSalt: number,
  wanderT: number,
  baseLat: number,
  baseLng: number,
  exploreCenter: [number, number],
): [number, number] {
  const leader = Math.floor(index / 4) * 4;
  const slot = index - leader;
  const rSquad = mulberry32(leader * 9301 + layerSalt * 51_111 + 888_888)();
  const pickI = (k: number) => mulberry32(index * 9301 + layerSalt * 4243 + k * 10007)();

  const cosLatExpl = Math.max(0.32, Math.abs(Math.cos((exploreCenter[0] * Math.PI) / 180)));
  const cosLatBase = Math.max(0.32, Math.abs(Math.cos((baseLat * Math.PI) / 180)));
  const T = wanderT * 0.24;

  if (rSquad < 0.2) return [0, 0];

  const stageAngle = mulberry32(layerSalt * 7723 + leader * 13 + 201)() * Math.PI * 2;
  const stageDistM = 16 + mulberry32(layerSalt * 5521 + leader)() * 22;
  const stageNorth = stageDistM * 0.52 * Math.sin(stageAngle);
  const stageEast = stageDistM * 0.52 * Math.cos(stageAngle);
  const stageLat = exploreCenter[0] + stageNorth / 111_320;
  const stageLng = exploreCenter[1] + stageEast / (111_320 * cosLatExpl);

  if (rSquad < 0.47) {
    const dn0 = (stageLat - baseLat) * 111_320;
    const de0 = (stageLng - baseLng) * 111_320 * cosLatBase;
    const dist0 = Math.hypot(dn0, de0) + 1e-6;
    const un = dn0 / dist0;
    const ue = de0 / dist0;
    const px = -ue;
    const py = un;
    const breathe = 0.52 + 0.48 * Math.sin(T * 0.44 + leader * 0.19);
    const towardM = 2.1 * breathe * Math.sin(T * 0.3 + leader * 0.11);
    const sideM = (slot - 1.5) * 1.05 + 0.5 * Math.sin(T * 0.52 + index * 0.37);
    const dNorth = un * towardM + px * sideM;
    const dEast = ue * towardM + py * sideM;
    return clampDeltaMeters(metersToLatLngDelta(dNorth, dEast, baseLat), baseLat, 8);
  }

  if (rSquad < 0.59) {
    const theta = mulberry32(leader * 44_041 + layerSalt * 331)() * Math.PI * 2;
    const dirN = Math.cos(theta);
    const dirE = Math.sin(theta);
    const jog = Math.sin(T * 0.88 + leader * 0.29) * 2.85;
    const spread = (slot - 1.5) * 1.05;
    const pn = -dirE;
    const pe = dirN;
    const dNorth = dirN * jog + pn * spread;
    const dEast = dirE * jog + pe * spread;
    return clampDeltaMeters(metersToLatLngDelta(dNorth, dEast, baseLat), baseLat, 9);
  }

  if (rSquad < 0.76) {
    const phi = mulberry32(leader * 31_415 + layerSalt * 272)() * Math.PI * 2;
    const dirN = Math.cos(phi);
    const dirE = Math.sin(phi);
    const walk = Math.sin(T * 0.35 + leader * 0.24) * 1.55;
    const spread = (slot - 1.5) * 0.78;
    const pn = -dirE;
    const pe = dirN;
    const dNorth = dirN * walk + pn * spread;
    const dEast = dirE * walk + pe * spread;
    return clampDeltaMeters(metersToLatLngDelta(dNorth, dEast, baseLat), baseLat, 6.2);
  }

  /* 소수: 차·오토바이 등 — 같은 방향·더 빠른 왕복(클램프만 넓게) */
  if (rSquad < 0.845) {
    const roadTheta = mulberry32(leader * 62_333 + layerSalt * 919)() * Math.PI * 2;
    const dirN = Math.cos(roadTheta);
    const dirE = Math.sin(roadTheta);
    const fast = Math.sin(T * 1.88 + leader * 0.19) * 4.9;
    const spread = (slot - 1.5) * 1.12;
    const pn = -dirE;
    const pe = dirN;
    const dNorth = dirN * fast + pn * spread;
    const dEast = dirE * fast + pe * spread;
    return clampDeltaMeters(metersToLatLngDelta(dNorth, dEast, baseLat), baseLat, 13.5);
  }

  const w1 = 0.12 + pickI(4) * 0.38;
  const w2 = 0.1 + pickI(5) * 0.36;
  const ph1 = pickI(6) * Math.PI * 2;
  const ph2 = pickI(7) * Math.PI * 2;
  const amp = 0.0000045 + pickI(8) * 0.000008;
  const t = T * 0.48;
  const dLat = Math.sin(t * w1 + ph1) * amp + Math.sin(t * w2 * 1.12 + ph2) * amp * 0.2;
  const dLng =
    (Math.cos(t * w2 + ph2) * amp * 1.06 + Math.cos(t * w1 + ph1) * amp * 0.16) / cosLatBase;
  return clampDeltaMeters([dLat, dLng], baseLat, 3.8);
}

/** 줌 레벨 추적 — 이후 줌 기반 클러스터/LOD에 연결 */
function ZoomLevelTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    onZoomChange(map.getZoom());
    const onZoomEnd = () => onZoomChange(map.getZoom());
    map.on('zoomend', onZoomEnd);
    return () => {
      map.off('zoomend', onZoomEnd);
    };
  }, [map, onZoomChange]);

  return null;
}

/**
 * 짧은 변(px)이 큰 패널·개발자 도구 비현실적 해상도에서는 동일 줌이 과도 확대로 보임 → 상한으로 완화.
 * 일반 폰(짧은 변 ~360–430)에서는 preferred 그대로.
 */
function followZoomForViewport(map: L.Map, preferred: number): number {
  if (!Number.isFinite(preferred)) return 14;
  try {
    const s = map.getSize();
    const minEdge = Math.min(s.x, s.y);
    if (!Number.isFinite(minEdge) || minEdge < 80) return preferred;
    if (minEdge <= 440) return preferred;
    if (minEdge <= 640) return Math.min(preferred, 15);
    if (minEdge <= 900) return Math.min(preferred, 14);
    if (minEdge <= 1400) return Math.min(preferred, 13);
    return Math.min(preferred, 12);
  } catch {
    return preferred;
  }
}

/** Flex·반응형·DevTools 기기 전환 시 Leaflet이 컨테이너 크기를 놓치는 경우 보정 */
function MapInvalidateOnResize() {
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    const bump = () => {
      map.invalidateSize({ animate: false, pan: false });
    };
    const onWin = () => {
      requestAnimationFrame(bump);
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('orientationchange', onWin);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        requestAnimationFrame(bump);
      });
      ro.observe(el);
    }
    requestAnimationFrame(() => {
      bump();
      requestAnimationFrame(bump);
    });
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('orientationchange', onWin);
      ro?.disconnect();
    };
  }, [map]);

  return null;
}

/**
 * 내 위치: 첫 유효 좌표는 flyTo.
 * 「내 위치」모드 + 추적 중에는 이후 좌표를 panTo로 따라가 화면 중앙에 유지.
 * 탐색 모드에선 지도는 사용자 드래그·지역 선택에 맡기고, 다시 내 위치 모드로 올 때
 * 지도 중심이 내 위치와 많이 어긋나 있으면 한 번 panTo로 맞춤.
 */
function MapSyncToMyLocation({
  center,
  zoom,
  followEnabled,
}: {
  center: [number, number] | null;
  zoom: number;
  /** liveTracking && locationMode === 'my_location' */
  followEnabled: boolean;
}) {
  const map = useMap();
  const flewRef = useRef(false);
  const lastCenterRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!center) {
      flewRef.current = false;
      lastCenterRef.current = null;
      return;
    }
    if (!isValidGeoLatLng(center[0], center[1])) return;

    const fixTiles = () => {
      map.invalidateSize();
    };
    const baseZ = Number.isFinite(zoom) ? zoom : 16;
    const z = followZoomForViewport(map, baseZ);

    if (!flewRef.current) {
      map.flyTo(center, z, { duration: 0.85 });
      flewRef.current = true;
      lastCenterRef.current = center;
      fixTiles();
      requestAnimationFrame(fixTiles);
      return;
    }

    if (!followEnabled) {
      lastCenterRef.current = center;
      return;
    }

    const last = lastCenterRef.current;
    const mapC = map.getCenter();
    const mapOffUserM = haversineMeters(
      { lat: mapC.lat, lng: mapC.lng },
      { lat: center[0], lng: center[1] },
    );
    const coordsMoved =
      !last || last[0] !== center[0] || last[1] !== center[1];

    if ((coordsMoved && last) || (!coordsMoved && mapOffUserM > 45)) {
      map.panTo(center, { animate: true, duration: 0.38, easeLinearity: 0.22 });
      fixTiles();
    }
    lastCenterRef.current = center;
  }, [center, followEnabled, map, zoom]);

  return null;
}

/** 탐색 지역을 탭으로 바꿀 때 지도 이동 */
function MapFlyToExploreOnPick({
  center,
  pickVersion,
}: {
  center: [number, number];
  pickVersion: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (pickVersion < 1) return;
    if (!isValidGeoLatLng(center[0], center[1])) return;
    const rawZ = map.getZoom();
    const safeZ = Number.isFinite(rawZ) ? Math.max(13, rawZ) : 14;
    map.flyTo(center, safeZ, { duration: 0.75 });
    const fixTiles = () => {
      map.invalidateSize();
    };
    fixTiles();
    requestAnimationFrame(fixTiles);
  }, [pickVersion, center, map]);
  return null;
}

/** 두 좌표 사이 방위각(도) — CSS rotate(0°=동쪽) */
function bearingDegrees(from: [number, number], to: [number, number]): number {
  const φ1 = (from[0] * Math.PI) / 180;
  const φ2 = (to[0] * Math.PI) / 180;
  const Δλ = ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function interpLatLng(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** SOS 펄스 링용 — 메타 색(hex) → rgba */
function sosHexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6 || Number.isNaN(parseInt(h, 16))) {
    return `rgba(255, 68, 68, ${alpha})`;
  }
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 핀·말풍선 짧은 라벨 — 공백 제거 후 앞 2글자 */
function pinLabelTwo(raw: string): string {
  const s = raw.replace(/\s+/g, '');
  return Array.from(s).slice(0, 2).join('');
}

/** AI 말풍선 인도 — 제목·한 줄 설명 */
function aiNudgeDestinationIcon(opts: {
  headline: string;
  placeTitle: string;
  blurb: string;
  accent: string;
}): L.DivIcon {
  const headline = escapeHtml(opts.headline);
  const place = escapeHtml(opts.placeTitle);
  const blurb = escapeHtml(opts.blurb);
  const accent = opts.accent;
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;max-width:min(92vw,300px);width:min(92vw,300px);">
        <div style="
          padding:10px 14px 9px;border-radius:14px 14px 0 0;
          background:linear-gradient(135deg,rgba(0,240,255,0.58),rgba(168,85,247,0.52));
          border:1px solid rgba(255,255,255,0.32);
          border-bottom:none;
          font-size:15px;font-weight:900;color:#0A0A0E;
          letter-spacing:-0.02em;line-height:1.25;
          text-shadow:0 0.5px 1px rgba(255,255,255,0.35);
          box-shadow:0 0 12px rgba(0,240,255,0.22);
        ">${headline}</div>
        <div style="
          padding:12px 14px 14px;border-radius:0 0 14px 14px;
          background:rgba(14,14,20,0.58);
          border:1px solid ${accent}55;
          border-top:1px solid rgba(255,255,255,0.1);
          text-align:center;
          box-shadow:0 6px 18px rgba(0,0,0,0.35);
        ">
          <div style="font-size:16px;font-weight:800;color:${accent};line-height:1.35;margin-bottom:6px;">${place}</div>
          <div style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.88);line-height:1.5;max-height:4.6em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${blurb}</div>
          <div style="margin-top:8px;font-size:12px;font-weight:700;color:rgba(0,240,255,0.82);">AI 인사이트 · 마이 조건 맞춤(부스트와 별개)</div>
        </div>
      </div>
    `,
    iconSize: [300, 210],
    iconAnchor: [150, 210],
  });
}

/** 화살표 옆 한 줄 힌트 */
function aiNudgeArrowHintIcon(deg: number, line: string): L.DivIcon {
  const safe = escapeHtml(line);
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="transform:rotate(${deg}deg);font-size:32px;line-height:1;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.65));">➤</div>
        <div style="margin-top:4px;padding:6px 12px;border-radius:999px;background:rgba(10,10,14,0.55);border:1px solid rgba(0,240,255,0.32);font-size:12px;font-weight:700;color:#00F0FF;max-width:min(88vw,220px);text-align:center;line-height:1.35;text-shadow:0 0 8px rgba(0,0,0,0.75);">${safe}</div>
      </div>
    `,
    iconSize: [220, 68],
    iconAnchor: [110, 34],
  });
}

/**
 * 내 위치 핀 + 주변 링 — 부모의 hbTick 등과 분리해 memo로 리렌더를 줄임(줌 시 번쩍임 완화).
 * 링 크기는 CSS 펄스에 맡기고 CircleMarker는 고정 픽셀 반경만 사용.
 */
const MePositionLayers = memo(
  function MePositionLayers({
    myLocation,
    exploreCenter,
    gpsIcon,
    exploreIcon,
  }: {
    myLocation: [number, number] | null;
    exploreCenter: [number, number];
    gpsIcon: L.DivIcon;
    exploreIcon: L.DivIcon;
  }) {
    const markerPos = myLocation ?? exploreCenter;
    const icon = myLocation ? gpsIcon : exploreIcon;
    return (
      <>
        {myLocation && (
          <CircleMarker
            center={myLocation}
            radius={18}
            pathOptions={{
              color: '#00F0FF',
              fillColor: '#00F0FF',
              fillOpacity: 0.14,
              weight: 0,
            }}
          />
        )}
        <Marker position={markerPos} icon={icon} zIndexOffset={900} />
      </>
    );
  },
  (prev, next) => {
    if (prev.gpsIcon !== next.gpsIcon || prev.exploreIcon !== next.exploreIcon) return false;
    if ((prev.myLocation === null) !== (next.myLocation === null)) return false;
    if (prev.myLocation && next.myLocation) {
      if (prev.myLocation[0] !== next.myLocation[0] || prev.myLocation[1] !== next.myLocation[1]) {
        return false;
      }
    }
    return (
      prev.exploreCenter[0] === next.exploreCenter[0] &&
      prev.exploreCenter[1] === next.exploreCenter[1]
    );
  },
);

function meAtCenterIcon(isGps: boolean): L.DivIcon {
  const label = isGps ? '위치' : '탐색';
  const border = isGps ? 'rgba(0,240,255,0.85)' : 'rgba(255,222,0,0.55)';
  const glow = isGps ? 'rgba(0,240,255,0.5)' : 'rgba(255,222,0,0.35)';
  const core = isGps ? '#00F0FF' : '#FFDE00';
  const pulseClass = isGps ? 'spotvibe-me-marker-pulse-ring--gps' : 'spotvibe-me-marker-pulse-ring--explore';
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;overflow:visible;width:96px;">
        <div class="spotvibe-me-marker-wrap">
          <span class="spotvibe-me-marker-pulse-ring ${pulseClass}" aria-hidden="true"></span>
          <span class="spotvibe-me-marker-pulse-ring ${pulseClass} spotvibe-me-marker-pulse-ring--delay" aria-hidden="true"></span>
          <div style="
            position:relative;z-index:2;
            width:14px;height:14px;border-radius:50%;
            background:${core};
            border:2px solid #fff;
            box-shadow:0 0 0 3px ${glow}, 0 0 12px ${glow};
          "></div>
        </div>
        <div style="margin-top:2px;padding:2px 6px;border-radius:6px;background:rgba(10,10,14,0.85);border:1px solid ${border};font-size:9px;font-weight:800;color:#fff;white-space:nowrap;">${label}</div>
      </div>
    `,
    iconSize: [96, 82],
    iconAnchor: [48, 28],
  });
}

/**
 * 타인 SOS 발신자 — 「내 위치」마커와 동일 계열(펄스 링·하단 라벨), 유형별 색·아이콘.
 */
function sosPeerMeStyleIcon(m: SosTypeMeta, opacity: number, hasPhoto = false): L.DivIcon {
  const safeLabel = escapeHtml(m.label);
  const ring = sosHexToRgba(m.color, 0.58);
  const ring2 = sosHexToRgba(m.color, 0.42);
  const glow = sosHexToRgba(m.color, 0.38);
  const glow2 = sosHexToRgba(m.color, 0.48);
  const photoBadge = hasPhoto
    ? '<span style="position:absolute;bottom:-5px;right:-7px;font-size:11px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.85));" aria-hidden="true">📷</span>'
    : '';
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon spotvibe-sos-map-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;overflow:visible;width:96px;opacity:${opacity};cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;">
        <div class="spotvibe-me-marker-wrap">
          <span class="spotvibe-me-marker-pulse-ring" style="border-color:${ring}" aria-hidden="true"></span>
          <span class="spotvibe-me-marker-pulse-ring spotvibe-me-marker-pulse-ring--delay" style="border-color:${ring2}" aria-hidden="true"></span>
          <div style="
            position:relative;z-index:2;
            width:32px;height:32px;border-radius:50%;
            background:${m.bg};
            border:2px solid ${m.color};
            box-shadow:0 0 0 3px ${glow}, 0 0 14px ${glow2};
            display:flex;align-items:center;justify-content:center;
            font-size:17px;line-height:1;
          ">${m.icon}${photoBadge}</div>
        </div>
        <div style="margin-top:2px;padding:2px 6px;border-radius:6px;background:rgba(10,10,14,0.88);border:1px solid ${m.color};font-size:9px;font-weight:800;color:#fff;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.85);">${safeLabel}</div>
      </div>
    `,
    iconSize: [96, 82],
    iconAnchor: [48, 28],
  });
}

/** 취약계층 마커 — 항상 표시, 작고 조용한 디자인 */
function vulnerablePersonIcon(emoji: string, color: string, label: string): L.DivIcon {
  const safe = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
        <div style="
          width:28px;height:28px;border-radius:50%;
          background:rgba(10,10,18,0.88);
          display:flex;align-items:center;justify-content:center;
          border:2px solid ${color};
          font-size:14px;line-height:1;
        ">${emoji}</div>
        <div style="
          margin-top:3px;padding:1.5px 5px;border-radius:5px;
          background:rgba(10,10,14,0.92);
          border:1px solid ${color}77;
          font-size:8px;font-weight:800;color:${color};
          white-space:nowrap;
        ">${safe}</div>
      </div>
    `,
    iconSize: [70, 50],
    iconAnchor: [35, 50],
  });
}

/** 시설물 제보 마커 (소화기·운동·꽃·쉼터 등) */
function facilityDivIcon(emoji: string, color: string, label: string): L.DivIcon {
  const safe = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="
        width:92px;height:72px;
        display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
        pointer-events:auto;cursor:pointer;
      ">
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${color}22;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 12px ${color}55;
          border:1.5px solid ${color}88;
          font-size:15px;line-height:1;
          pointer-events:auto;
        ">${emoji}</div>
        <div style="
          margin-top:3px;padding:2px 6px;border-radius:6px;
          background:rgba(10,10,14,0.92);
          border:1px solid ${color}55;
          font-size:8.5px;font-weight:800;color:${color};
          white-space:nowrap;
          pointer-events:auto;
        ">${safe}</div>
      </div>
    `,
    iconSize: [92, 72],
    iconAnchor: [46, 72],
  });
}

const FACILITY_IMG_SRC_RE = /^\/[a-zA-Z0-9/_\-.]+\.(svg|png|webp|jpg|jpeg)$/i;

/** 데모 시설: 탐색/내 위치 중심과 좌표가 다르면 핀이 화면 밖 — 500m 원 안에 보이게 배치 */
function facilityDemoMapPosition(center: [number, number], id: string, index: number): [number, number] {
  let h = 2_166_136_261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 1_677_7619);
  }
  const u = ((h >>> 0) % 10_000) / 10_000;
  const angle = u * Math.PI * 2;
  const meters = 130 + ((Math.abs(h) >>> 0) % 260) + index * 28;
  const cosLat = Math.cos((center[0] * Math.PI) / 180);
  const dLat = (meters * Math.cos(angle)) / 111_320;
  const dLng = (meters * Math.sin(angle)) / (111_320 * Math.max(0.2, Math.abs(cosLat)));
  return [center[0] + dLat, center[1] + dLng];
}

type FacilityDivIconImgOpts = { badgePx?: number; imgPx?: number };

/** 시설물 마커 — 공공 쓰레기통·흡연실 등 SVG 픽토그램 */
function facilityDivIconImg(
  imgSrc: string,
  color: string,
  label: string,
  fallbackSrc: string = PUBLIC_TRASH_MAP_ICON,
  opts?: FacilityDivIconImgOpts,
): L.DivIcon {
  const safe = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const src = FACILITY_IMG_SRC_RE.test(imgSrc) ? imgSrc : FACILITY_IMG_SRC_RE.test(fallbackSrc) ? fallbackSrc : PUBLIC_TRASH_MAP_ICON;
  const imgPx = opts?.imgPx ?? 20;
  const badgePx = opts?.badgePx ?? 32;
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="
        width:92px;height:72px;
        display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
        pointer-events:auto;cursor:pointer;
      ">
        <div style="
          width:${badgePx}px;height:${badgePx}px;border-radius:50%;
          background:${color}22;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 12px ${color}55;
          border:1.5px solid ${color}88;
          pointer-events:auto;
        "><img src="${src}" alt="" width="${imgPx}" height="${imgPx}" style="display:block;object-fit:contain" /></div>
        <div style="
          margin-top:3px;padding:2px 6px;border-radius:6px;
          background:rgba(10,10,14,0.92);
          border:1px solid ${color}55;
          font-size:8.5px;font-weight:800;color:${color};
          white-space:nowrap;
          pointer-events:auto;
        ">${safe}</div>
      </div>
    `,
    iconSize: [92, 72],
    iconAnchor: [46, 72],
  });
}

function eventDivIcon(label: string, accent: string, emoji: string): L.DivIcon {
  const safe = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
        <div style="
          width:38px;height:38px;border-radius:50%;
          background:${accent};
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 18px ${accent}99;
          border:2px solid rgba(255,255,255,0.35);
          font-size:18px;line-height:1;
        ">${emoji}</div>
        <div style="
          margin-top:5px;padding:4px 9px;border-radius:8px;
          background:rgba(26,26,36,0.94);
          border:1px solid ${accent}55;
          font-size:10px;font-weight:800;color:${accent};
          white-space:nowrap;letter-spacing:-0.02em;
          box-shadow:0 4px 14px rgba(0,0,0,0.45);
        ">${safe}</div>
      </div>
    `,
    iconSize: [140, 78],
    iconAnchor: [70, 78],
    popupAnchor: [0, -72],
  });
}

type AiNudgeSpot = {
  id: string;
  position: [number, number];
  title: string;
  emoji: string;
  accent: string;
};

function syntheticNudgeSpots(center: [number, number]): AiNudgeSpot[] {
  return [
    {
      id: 'syn_social',
      position: [center[0] + 0.00105, center[1] + 0.00075],
      title: '이 근처 소셜 허브',
      emoji: '✨',
      accent: '#FFDE00',
    },
    {
      id: 'syn_evening',
      position: [center[0] - 0.00085, center[1] - 0.00095],
      title: '저녁·야경 산책 코스',
      emoji: '🌙',
      accent: '#A855F7',
    },
    {
      id: 'syn_cafe',
      position: [center[0] + 0.00035, center[1] - 0.00115],
      title: '카페·수다 스팟',
      emoji: '☕',
      accent: '#FB923C',
    },
  ];
}

function buildPersonalizedTail(
  genderPref: 'all' | 'female_crowd' | 'male_crowd',
  activityTags?: Set<string>,
  mbtiSet?: Set<string>,
  bloodTypeSet?: Set<string>,
): string {
  const bits: string[] = [];
  if (activityTags && activityTags.size > 0) {
    bits.push(`${Array.from(activityTags).slice(0, 2).join('·')}에 어울리는`);
  }
  if (genderPref === 'female_crowd') bits.push('여성 인파 많은');
  else if (genderPref === 'male_crowd') bits.push('남성 인파 많은');
  if (mbtiSet && mbtiSet.size > 0) bits.push(`${Array.from(mbtiSet)[0]} 성향`);
  if (bloodTypeSet && bloodTypeSet.size > 0) {
    const labels = Array.from(bloodTypeSet).map((bt) => BLOOD_TYPE_OVERLAY[bt]?.label ?? `${bt}형`);
    bits.push(`${labels.join('·')} 취향`);
  }
  if (bits.length === 0) return '마이에서 고른 조건으로 인파 많은 쪽을 골라봤어.';
  return `${bits.join(' · ')} 쪽으로 집계됐을 때 인파가 두드러지는 흐름이야.`;
}

function buildBlurbLine(spot: AiNudgeSpot, tail: string): string {
  return `${spot.title} 쪽은 반응이 좋아 보여. ${tail}`;
}

/** 지역별 고정 이벤트 마커 */
const EVENT_MARKERS: {
  id: string;
  position: [number, number];
  label: string;
  accent: string;
  emoji: string;
  /** 이 지역 근처일 때만 표시 (null = 항상) */
  regionId: string;
}[] = [
  /* ── 홍대·연남 ── */
  { id: 'flea',         regionId: 'hongdae', position: [37.56105, 126.92545], label: '플리마켓 타임세일', accent: M20.accent, emoji: '🛍️' },
  { id: 'busking',      regionId: 'hongdae', position: [37.55435, 126.91895], label: '인디 밴드 버스킹',  accent: M30.accent, emoji: '🎸' },

  /* ── 안양·평촌 동안구 ── */
  { id: 'anyang_park',  regionId: 'anyang',  position: [37.3965, 126.9488],  label: '평촌중앙공원 야외공연', accent: M20.accent, emoji: '🎪' },
  { id: 'anyang_flea',  regionId: 'anyang',  position: [37.3895, 126.9535],  label: '범계역 플리마켓',      accent: M30.accent, emoji: '🛍️' },
  { id: 'anyang_cafe',  regionId: 'anyang',  position: [37.3928, 126.9512],  label: '평촌 카페거리 모임',   accent: M40.accent, emoji: '☕' },
  { id: 'anyang_popup', regionId: 'anyang',  position: [37.3945, 126.9540],  label: '롯데몰 팝업스토어',    accent: M20.accent, emoji: '🏪' },

  /* ── 강남·역삼 ── */
  { id: 'gangnam_popup', regionId: 'gangnam', position: [37.4990, 127.0280], label: '강남 브랜드 팝업',    accent: M20.accent, emoji: '🏪' },
  { id: 'gangnam_rooftop', regionId: 'gangnam', position: [37.4968, 127.0255], label: '루프탑·바 모임', accent: M30.accent, emoji: '🍹' },

  /* ── 부산 광안리·해운대 ── */
  { id: 'busan_gwang_night', regionId: 'gwangalli', position: [35.1538, 129.119], label: '광안리 야경 산책', accent: '#38BDF8', emoji: '🌉' },
  { id: 'busan_haeundae_sand', regionId: 'haeundae', position: [35.1585, 129.1608], label: '해운대 밤바다 산책', accent: '#4ADE80', emoji: '🏖️' },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AI 추천 풀 — 지역별 후보 + 개인화 스코어링
   실제 서비스에서는 서버 API 응답으로 교체
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
type AiRec = {
  id: string;
  regionId: string;
  position: [number, number];
  emoji: string;
  title: string;
  description: string;
  why: string;
  accent: string;
  tags: string[];
  mbtiBoost: string[];
  crowdBoost: ('all' | 'female_crowd' | 'male_crowd')[];
  /** 익명 집계 가정 인파 강도 — 맞춤 점수가 같을 때 높은 순 */
  crowdHotScore: number;
};

const AI_REC_POOL: AiRec[] = [
  /* ── 홍대·연남 ── */
  {
    id: 'hongdae_busking_alley',
    regionId: 'hongdae',
    position: [37.5553, 126.9228],
    emoji: '🎸',
    title: '홍대 버스킹 골목',
    description: '매주 금·토 저녁 인디 밴드·EDM·힙합까지 다양한 길거리 공연이 열려요.',
    why: '공연·수다 태그 익명 집계에서 반응이 몰리고, 30대 이상 비율이 높게 잡혀 있어요.',
    accent: '#FF6B6B',
    tags: ['공연', '수다', '야경'],
    mbtiBoost: ['ENFP', 'ENFJ', 'ESFP', 'ENTP'],
    crowdBoost: ['all', 'female_crowd'],
    crowdHotScore: 88,
  },
  {
    id: 'hongdae_flea_market',
    regionId: 'hongdae',
    position: [37.5610, 126.9255],
    emoji: '🛍️',
    title: '연남동 플리마켓',
    description: '핸드메이드 소품부터 빈티지 의류까지 한 곳에서. 지금 세일 타임이에요!',
    why: '쇼핑·소풍 태그 집계가 올라가 있고, 20대 여성 인파 비중이 높게 나와요.',
    accent: '#FFDE00',
    tags: ['쇼핑', '소풍', '야외'],
    mbtiBoost: ['ENFP', 'ESFP', 'ISFP', 'ENTP'],
    crowdBoost: ['all', 'female_crowd'],
    crowdHotScore: 91,
  },
  {
    id: 'hongdae_cafe_row',
    regionId: 'hongdae',
    position: [37.5568, 126.9198],
    emoji: '☕',
    title: '연남동 카페 골목',
    description: '감성 소품·조용한 BGM 카페들이 200m 안에 밀집. 혼자도 둘이도 딱이에요.',
    why: '카페·수다 태그와 I 성향 MBTI가 겹치는 익명 패턴이 많이 잡혀요.',
    accent: '#D97706',
    tags: ['카페', '수다'],
    mbtiBoost: ['INFP', 'INFJ', 'ISFP', 'ISFJ', 'ISTP', 'INTJ'],
    crowdBoost: ['all'],
    crowdHotScore: 74,
  },
  {
    id: 'hongdae_rooftop',
    regionId: 'hongdae',
    position: [37.5526, 126.9212],
    emoji: '🌙',
    title: '홍대 루프탑 바',
    description: '야경이 탁 트이는 루프탑. 금요일 밤 최대 인기 구역이에요.',
    why: '야경·클럽 태그 + 30대 여성 인파 비중이 동시에 올라가는 시간대로 집계돼요.',
    accent: '#A855F7',
    tags: ['야경', '클럽', '수다'],
    mbtiBoost: ['ENFJ', 'ESTP', 'ENTJ', 'ESFP'],
    crowdBoost: ['all', 'female_crowd', 'male_crowd'],
    crowdHotScore: 86,
  },

  /* ── 안양·평촌 ── */
  {
    id: 'anyang_central_park',
    regionId: 'anyang',
    position: [37.3965, 126.9488],
    emoji: '🎪',
    title: '평촌 중앙공원 야외공연',
    description: '가족·연인이 함께하는 무료 야외 공연. 지금 행사 중이에요.',
    why: '야외·소풍 태그 활성 + 전 연령 인파가 이 구역에 몰린다고 집계돼요.',
    accent: M20.accent,
    tags: ['야외', '소풍', '공연', '운동'],
    mbtiBoost: ['ENFP', 'ESFJ', 'ISFJ', 'ESFP'],
    crowdBoost: ['all'],
    crowdHotScore: 79,
  },
  {
    id: 'anyang_beomgye_flea',
    regionId: 'anyang',
    position: [37.3895, 126.9535],
    emoji: '🛍️',
    title: '범계역 앞 플리마켓',
    description: '매월 첫째 주 토요일 개장. 빈티지·핸드메이드 100개 이상 부스.',
    why: '쇼핑 태그 집중 + 20·30대 여성 인파가 가장 두껍게 나와요.',
    accent: M30.accent,
    tags: ['쇼핑', '소풍', '수다'],
    mbtiBoost: ['ESFP', 'ENFP', 'ISFP', 'ESFJ'],
    crowdBoost: ['female_crowd', 'all'],
    crowdHotScore: 84,
  },
  {
    id: 'anyang_cafe_street',
    regionId: 'anyang',
    position: [37.3928, 126.9512],
    emoji: '☕',
    title: '평촌 카페거리',
    description: '조용한 브런치 카페부터 트렌디한 스페셜티까지 한 블록에 모두 있어요.',
    why: '카페 태그 + MBTI I 계열 익명 패턴이 자주 겹치는 구간이에요.',
    accent: M40.accent,
    tags: ['카페', '수다'],
    mbtiBoost: ['INFP', 'INTJ', 'INFJ', 'INTP', 'ISFJ'],
    crowdBoost: ['all'],
    crowdHotScore: 71,
  },
  {
    id: 'anyang_lotte_popup',
    regionId: 'anyang',
    position: [37.3945, 126.9540],
    emoji: '🏪',
    title: '롯데몰 팝업스토어',
    description: '이번 주 한정 브랜드 팝업 3개 동시 진행. 줄 서기 전에 가세요!',
    why: '쇼핑 태그 + 20·30대 전 성별 인파가 동시에 몰리는 핫존으로 집계돼요.',
    accent: M20.accent,
    tags: ['쇼핑'],
    mbtiBoost: ['ENFJ', 'ESFJ', 'ESTP', 'ESTJ'],
    crowdBoost: ['all', 'female_crowd', 'male_crowd'],
    crowdHotScore: 90,
  },

  /* ── 강남·역삼 ── */
  {
    id: 'gangnam_brand_popup',
    regionId: 'gangnam',
    position: [37.4990, 127.0280],
    emoji: '🏪',
    title: '강남 브랜드 팝업',
    description: '최신 콜라보 팝업 스토어. 인증샷 스팟이 잘 나오기로 유명해요.',
    why: '쇼핑·수다 태그 + 20대 E 성향 MBTI 몰림이 겹치는 포인트로 나와요.',
    accent: M20.accent,
    tags: ['쇼핑', '수다'],
    mbtiBoost: ['ENFP', 'ESFP', 'ENTP', 'ESTP'],
    crowdBoost: ['all', 'female_crowd'],
    crowdHotScore: 89,
  },
  {
    id: 'gangnam_rooftop_bar',
    regionId: 'gangnam',
    position: [37.4968, 127.0255],
    emoji: '🍹',
    title: '강남 루프탑·바',
    description: '강남 야경과 함께 칵테일 한 잔. 금요일 저녁 최고 인기 스팟이에요.',
    why: '야경·클럽 태그 + 30대 남녀 인파가 함께 올라가는 시간대로 집계돼요.',
    accent: M30.accent,
    tags: ['야경', '클럽', '수다'],
    mbtiBoost: ['ENTJ', 'ENFJ', 'ESTP', 'ESTJ'],
    crowdBoost: ['all', 'male_crowd'],
    crowdHotScore: 87,
  },

  /* ── 부산 광안리·해운대 ── */
  {
    id: 'gwangalli_bridge_night',
    regionId: 'gwangalli',
    position: [35.1535, 129.1185],
    emoji: '🌉',
    title: '광안대교 야경·산책로',
    description: '밤바다와 다리 불빛이 한눈에. 주말 밤 유동이 가장 길게 이어져요.',
    why: '야경·수다 태그 + 20·30대 남녀 인파가 동시에 두껍게 잡히는 구간이에요.',
    accent: '#38BDF8',
    tags: ['야경', '수다', '야외'],
    mbtiBoost: ['ENFP', 'ESFP', 'ENFJ', 'ESFJ'],
    crowdBoost: ['all', 'female_crowd', 'male_crowd'],
    crowdHotScore: 94,
  },
  {
    id: 'gwangalli_raw_fish_alley',
    regionId: 'gwangalli',
    position: [35.1552, 129.1212],
    emoji: '🦑',
    title: '민락 수변 횟집 골목',
    description: '회·조개구이 골목이 한 줄로 이어져 있어요. 저녁 시간 인파가 정점이에요.',
    why: '맛집·수다 태그 집계 + 30·40대 남성 인파 비중이 높게 나와요.',
    accent: '#FB923C',
    tags: ['맛집', '수다', '야경'],
    mbtiBoost: ['ESTP', 'ESTJ', 'ENTJ', 'ESFJ'],
    crowdBoost: ['all', 'male_crowd'],
    crowdHotScore: 82,
  },
  {
    id: 'haeundae_beach_evening',
    regionId: 'haeundae',
    position: [35.1592, 129.1615],
    emoji: '🏖️',
    title: '해운대 해수욕장 저녁 산책',
    description: '노을 이후에도 밀도가 유지되는 편이에요. 러닝·산책 크루가 섞여 있어요.',
    why: '야외·운동 태그 + 20·30대 균형 인파로 집계되는 해변 구간이에요.',
    accent: '#4ADE80',
    tags: ['야외', '운동', '수다'],
    mbtiBoost: ['ENFP', 'ESFP', 'ESTP', 'ISFP'],
    crowdBoost: ['all', 'female_crowd'],
    crowdHotScore: 88,
  },
  {
    id: 'haeundae_marine_city',
    regionId: 'haeundae',
    position: [35.1568, 129.1538],
    emoji: '🍸',
    title: '마린시티·요트존 라운지',
    description: '고층 라운지와 요트 선착장이 인접해 있어요. 금·토 밤 인파가 두드러져요.',
    why: '야경·클럽 태그 + 30대 여성 인파 비중이 올라가는 시간대로 보여요.',
    accent: '#A855F7',
    tags: ['야경', '클럽', '수다'],
    mbtiBoost: ['ENFJ', 'ENTP', 'ESFP', 'ENTJ'],
    crowdBoost: ['all', 'female_crowd'],
    crowdHotScore: 86,
  },
];

const AI_REC_COUNTDOWN_SEC = 30;

function scoreAiRec(
  rec: AiRec,
  genderPref: 'all' | 'female_crowd' | 'male_crowd',
  activityTags?: Set<string>,
  mbtiSet?: Set<string>,
  bloodTypeSet?: Set<string>,
): number {
  let score = 0;
  // 활동 태그 매칭
  if (activityTags) {
    for (const t of activityTags) {
      if (rec.tags.includes(t)) score += 3;
    }
  }
  // MBTI 매칭
  if (mbtiSet) {
    for (const m of mbtiSet) {
      if (rec.mbtiBoost.includes(m)) score += 2;
    }
  }
  // 혈액형 친화 태그 매칭
  if (bloodTypeSet) {
    for (const bt of bloodTypeSet) {
      const affinityTags = BLOOD_TYPE_OVERLAY[bt]?.affinityTags ?? [];
      for (const tag of affinityTags) {
        if (rec.tags.includes(tag)) score += 1;
      }
    }
  }
  // 인파 성향(성별 밀집 선호) — «집계 추천» 가중
  if (genderPref !== 'all' && rec.crowdBoost.includes(genderPref)) score += 6;
  else if (genderPref === 'all' && rec.crowdBoost.includes('all')) score += 1;
  return score;
}

function sortedAiRecs(
  candidates: AiRec[],
  genderPref: 'all' | 'female_crowd' | 'male_crowd',
  activityTags?: Set<string>,
  mbtiSet?: Set<string>,
  bloodTypeSet?: Set<string>,
): AiRec[] {
  return [...candidates]
    .map((r) => ({ rec: r, score: scoreAiRec(r, genderPref, activityTags, mbtiSet, bloodTypeSet) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.rec.crowdHotScore - a.rec.crowdHotScore;
    })
    .map((x) => x.rec);
}

/** 활성 추천 전용 핀 아이콘 */
function aiActivePinIcon(accent: string, emoji: string, title: string): L.DivIcon {
  const safe = escapeHtml(pinLabelTwo(title));
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="
          width:52px;height:52px;border-radius:50%;
          background:radial-gradient(circle at 38% 38%, ${accent}dd, ${accent}88);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 0 3px ${accent}55, 0 0 28px ${accent}77;
          border:2px solid rgba(255,255,255,0.55);
          font-size:24px;line-height:1;
          animation:spotvibe-ping 1.6s cubic-bezier(0,0,0.2,1) infinite;
        ">${emoji}</div>
        <div style="
          margin-top:6px;padding:4px 10px;border-radius:8px;
          background:rgba(10,10,14,0.95);
          border:1.5px solid ${accent}88;
          font-size:11px;font-weight:900;color:${accent};
          white-space:nowrap;letter-spacing:-0.02em;
          box-shadow:0 4px 18px rgba(0,0,0,0.6), 0 0 14px ${accent}44;
        ">${safe}</div>
      </div>`,
    iconSize: [160, 88],
    iconAnchor: [80, 88],
  });
}

export function MapArea({
  onClusterClick,
  onExplorePicked,
  dataMode = 'real',
  profileAgeRange = '30대',
  matchedUsers = [],
  mbtiSet,
  bloodTypeSet,
  genderPref = 'all',
  activityTags,
  exploreAnchor = DEFAULT_EXPLORE_CENTER,
  exploreJumpSeq = 0,
  onExploreAnchorCommit = () => {},
  onOpenRouteSheetTo,
  onReportSubmitted,
  livePhotoFeedEnabled = false,
  isAdmin = false,
  onMapLocationShareActiveChange = () => {},
  locationMode = 'my_location',
  mapMinimalChrome = false,
  sosSignals = [],
  myActiveSosSignalId = null,
  onSosOpen,
  onSosPeerSelect,
  onMapClientMyLocationChange = () => {},
  isActive = true,
  userId = null,
  mapServerEnabled = true,
}: MapAreaProps) {
  const simOn = dataMode === 'test';
  const profilePal = useMemo(() => getAgeGenderColors(profileAgeRange), [profileAgeRange]);
  const crowdTight = useMemo(
    () => crowdFilterTightness(bloodTypeSet, mbtiSet, activityTags),
    [bloodTypeSet, mbtiSet, activityTags],
  );
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM);
  const [mapReady, setMapReady] = useState(false);
  /** 지도에서 탭해 고른 탐색 중심(히트맵·클러스터·이벤트 핀 기준) */
  const [exploreCenter, setExploreCenter] = useState<[number, number]>(() => exploreAnchor);
  /** 좌하단 지역 프리셋 칩 — 기본 접힘, 버튼으로만 펼침 */
  const [regionPresetPanelOpen, setRegionPresetPanelOpen] = useState(false);
  const [regionPickVersion, setRegionPickVersion] = useState(0);
  const [livePhotosOpen, setLivePhotosOpen] = useState(false);
  /** 소화기 긴급 조회 시트 */
  const [fireExtOpen, setFireExtOpen] = useState(false);
  /** 취약계층 도움 안내 시트 */
  const [disabledHelpOpen, setDisabledHelpOpen] = useState(false);
  /** 시각장애인 이웃 도움 메시지 전송 시트 */
  const [viNeighborSendOpen, setViNeighborSendOpen] = useState(false);
  /** 동네 숨은 장소 카테고리 시트 */
  const [categoryOpen, setCategoryOpen] = useState(false);
  /** 카테고리 시트에 표시할 카테고리 */
  const [categoryFilter, setCategoryFilter] = useState<'nature' | 'gym'>('nature');
  /** 활성 시설물 레이어 */
  const [activeFacilityLayer, setActiveFacilityLayer] = useState<'fire' | 'toilet' | 'gym' | 'trash' | 'smoking' | null>(null);
  /** 마커 클릭 → 사진·신고 시트 */
  const [selectedMarker, setSelectedMarker] = useState<MarkerItem | null>(null);
  /** 시설물 마커 데이터 (신고 카운트 포함) */
  const [facilityMarkers, setFacilityMarkers] = useState<MarkerItem[]>([
    { id: 'f1', type: 'fire',   emoji: '🧯',  label: '소화기',          description: '숲길안내센터 옆 보관함 · 산불진화 호스 포함', dist: 120, reportedAt: '2026-05-08', reporterName: '등산러버',   photoUrl: '/demo/spot1.jpg', reportCount: 0, gone: false, lat: 37.3916 - 0.0014, lng: 126.9668 - 0.0013 },
    { id: 'f2', type: 'fire',   emoji: '🧯',  label: '소화기',          description: '숲길안내센터 내부 입구 좌측',                 dist: 280, reportedAt: '2026-05-08', reporterName: '산타는사람', photoUrl: '/demo/spot2.jpg', reportCount: 0, gone: false, lat: 37.3916 - 0.0012, lng: 126.9668 + 0.0014 },
    { id: 'f3', type: 'fire',   emoji: '🧯',  label: '소화기',          description: '산중반쯤 소화기 있어요 · 어제 설치되었다네요... 유용할듯', dist: 430, reportedAt: '2026-05-08', reporterName: '등산객',     photoUrl: '/demo/spot-fire-mountain-mid.png', reportCount: 2, gone: false, lat: 37.3916 + 0.0018, lng: 126.9668 - 0.0008 },
    { id: 'f4', type: 'fire',   emoji: '🧯',  label: '소화기',          description: '공원 매점 옆 기둥',                           dist: 340, reportedAt: '2026-05-01', reporterName: '공원지킴이', photoUrl: '/demo/spot3.jpg', reportCount: 0, gone: false, lat: 37.3916 - 0.0022, lng: 126.9668 + 0.0022 },
    { id: 't1', type: 'toilet', emoji: '', mapIconSrc: TOILET_MAP_ICON, demoAroundCenter: true, label: '공원 공중화장실', description: '중앙공원 북쪽 입구 · 24시간 개방',             dist: 95,  reportedAt: '2026-05-07', reporterName: '공원산책',   photoUrl: '/demo/spot1.jpg', reportCount: 0, gone: false, lat: 37.3916 + 0.0009, lng: 126.9668 - 0.0011 },
    { id: 't2', type: 'toilet', emoji: '', mapIconSrc: TOILET_MAP_ICON, demoAroundCenter: true, label: '등산로 화장실',   description: '등산로 입구에 간이 화장실 있어요 · 휴지는 없음', dist: 310, reportedAt: '2026-05-08', reporterName: '동네주민',   photoUrl: '/demo/spot-toilet-trail.png', reportCount: 0, gone: false, lat: 37.3916 - 0.0013, lng: 126.9668 + 0.0016 },
    { id: 't3', type: 'toilet', emoji: '', mapIconSrc: TOILET_MAP_ICON, demoAroundCenter: true, label: '커피숍 화장실',   description: '무료사용가능 · 안양 개천옆',                  dist: 460, reportedAt: '2026-05-08', reporterName: '동네주민',  photoUrl: '/demo/spot-toilet-cafe.png', reportCount: 1, gone: false, lat: 37.3916 + 0.0020, lng: 126.9668 + 0.0010 },
    { id: 'g1', type: 'gym', emoji: '', mapIconSrc: OUTDOOR_GYM_MAP_ICON, demoAroundCenter: true, label: '야외 헬스장',     description: '개천가 옆 운동기구',                            dist: 220, reportedAt: '2026-05-08', reporterName: '동네주민', photoUrl: '/demo/spot-outdoor-gym.png', reportCount: 0, gone: false, lat: 37.3916 + 0.0016, lng: 126.9668 - 0.0015 },
    { id: 'g2', type: 'gym', emoji: '', mapIconSrc: OUTDOOR_GYM_MAP_ICON, demoAroundCenter: true, label: '배드민턴장',      description: '공원 내 무료 배드민턴 코트 2면',               dist: 380, reportedAt: '2026-05-03', reporterName: '배민러버',   photoUrl: '/demo/spot3.jpg', reportCount: 0, gone: false, lat: 37.3916 - 0.0018, lng: 126.9668 + 0.0012 },
    { id: 'g3', type: 'gym', emoji: '', mapIconSrc: OUTDOOR_GYM_MAP_ICON, demoAroundCenter: true, label: '야외 운동기구',   description: '한양아파트 뒷편 운동기구 처음봄',                dist: 510, reportedAt: '2026-05-08', reporterName: '동네주민',   photoUrl: '/demo/spot-gym-riverside.png', reportCount: 0, gone: false, lat: 37.3916 + 0.0025, lng: 126.9668 + 0.0018 },
    {
      id: 'z1',
      type: 'trash',
      emoji: '',
      mapIconSrc: PUBLIC_TRASH_MAP_ICON,
      demoAroundCenter: true,
      label: '공원 분리수거함',
      description: '일반·재활용 2칸 · 관리사무소 앞',
      dist: 155,
      reportedAt: '2026-05-08',
      reporterName: '산책러',
      photoUrl: '/demo/spot3.jpg',
      reportCount: 0,
      gone: false,
      lat: 37.3916 + 0.0004,
      lng: 126.9668 + 0.0005,
    },
    {
      id: 'z2',
      type: 'trash',
      emoji: '',
      mapIconSrc: PUBLIC_TRASH_MAP_ICON,
      demoAroundCenter: true,
      label: '등산로 쉼터 쓰레기통',
      description: '정상 가는 길 중턱 · 비닐 봉투 비치',
      dist: 340,
      reportedAt: '2026-05-07',
      reporterName: '등산객',
      photoUrl: '/demo/spot-trail.png',
      reportCount: 0,
      gone: false,
      lat: 37.3916 - 0.0006,
      lng: 126.9668 + 0.0020,
    },
    {
      id: 'z3',
      type: 'trash',
      emoji: '',
      mapIconSrc: PUBLIC_TRASH_MAP_ICON,
      demoAroundCenter: true,
      label: '개천 산책로 수거함',
      description: '반려견 배변봉투 옆',
      dist: 290,
      reportedAt: '2026-05-06',
      reporterName: '동네주민',
      photoUrl: '/demo/spot1.jpg',
      reportCount: 1,
      gone: false,
      lat: 37.3916 + 0.0011,
      lng: 126.9668 - 0.0004,
    },
    {
      id: 'k1',
      type: 'smoking',
      emoji: '',
      mapIconSrc: SMOKING_ROOM_MAP_ICON,
      demoAroundCenter: true,
      label: '역 광장 흡연부스',
      description: '유리부스 2칸 · 환풍 표시',
      dist: 175,
      reportedAt: '2026-05-08',
      reporterName: '통근러',
      photoUrl: '/demo/spot3.jpg',
      reportCount: 0,
      gone: false,
      lat: 37.3916 + 0.0002,
      lng: 126.9668 - 0.0018,
    },
    {
      id: 'k2',
      type: 'smoking',
      emoji: '',
      mapIconSrc: SMOKING_ROOM_MAP_ICON,
      demoAroundCenter: true,
      label: '백화점 후면 흡연실',
      description: '옥외 지정구역 · 재떨이 비치',
      dist: 320,
      reportedAt: '2026-05-07',
      reporterName: '동네주민',
      photoUrl: '/demo/spot1.jpg',
      reportCount: 0,
      gone: false,
      lat: 37.3916 - 0.0010,
      lng: 126.9668 - 0.0012,
    },
    {
      id: 'k3',
      type: 'smoking',
      emoji: '',
      mapIconSrc: SMOKING_ROOM_MAP_ICON,
      demoAroundCenter: true,
      label: '공원 동쪽 흡연장',
      description: '벤치·쓰레기통 인접',
      dist: 410,
      reportedAt: '2026-05-06',
      reporterName: '산책러',
      photoUrl: '/demo/spot-trail.png',
      reportCount: 1,
      gone: false,
      lat: 37.3916 + 0.0018,
      lng: 126.9668 + 0.0008,
    },
  ]);
  /** 화장실 시트 */
  const [toiletOpen, setToiletOpen] = useState(false);
  /** 공공 쓰레기통 시트 */
  const [trashOpen, setTrashOpen] = useState(false);
  /** 흡연실 시트 */
  const [smokingOpen, setSmokingOpen] = useState(false);
  /** 우측 퀵 패널 펼침 상태 */
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);
  /** 상단 장애인 표시 버튼 안내 토스트 */
  const [vulnerableGuideOpen, setVulnerableGuideOpen] = useState(false);
  /** 실시간 위치·분포 안내 패널 */
  const [locationFactsOpen, setLocationFactsOpen] = useState(false);
  /** 지역 프리셋 등으로 중심을 바꾼 직후 — 경로 보기 CTA */
  const [pendingRouteCenter, setPendingRouteCenter] = useState<[number, number] | null>(null);
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [liveTracking, setLiveTracking] = useState(false);
  const [locateUi, setLocateUi] = useState<
    'idle' | 'loading' | 'denied' | 'unsupported' | 'tracking'
  >('idle');
  /** 1분 단위 drift — seed offset이 바뀌면 점 좌표가 조금씩 이동 */
  const [driftTick, setDriftTick] = useState(0);
  /** 테스트 모드 가상 점 미세 움직임 — 프레임 카운터 */
  const [simWanderTick, setSimWanderTick] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  /** 마지막 유효 픽스 이후 세션 종료 타이머(신호 끊김 시 마커 유지 길이) */
  const lastKnownHoldTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  /** watch 끊김 후 getCurrentPosition 재시도 */
  const gpsReconnectIntervalRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  /** watchPosition 폭주 시 Leaflet 타일/뷰가 깨지는 것을 막기 위한 스로틀 */
  const watchEmitAtRef = useRef(0);
  /** 화면에 반영한 마지막 GPS — 미세 튐(특히 줌인 시) 필터 */
  const lastStableGpsRef = useRef<[number, number] | null>(null);
  /** `stopLiveLocation` 최신 참조 — 홀드 타이머 콜백에서 사용 */
  const stopLiveLocationRef = useRef<() => void>(() => {});
  /** 브라우저가 좌표를 스트리밍 중일 때만 true — DB 위치 공유와 동기 */
  const [gpsStreaming, setGpsStreaming] = useState(false);
  const vulnerableGuideTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const showVulnerableGuide = useCallback(() => {
    if (vulnerableGuideTimerRef.current) {
      window.clearTimeout(vulnerableGuideTimerRef.current);
      vulnerableGuideTimerRef.current = null;
    }
    setVulnerableGuideOpen(true);
    vulnerableGuideTimerRef.current = window.setTimeout(() => {
      setVulnerableGuideOpen(false);
      vulnerableGuideTimerRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => () => {
    if (vulnerableGuideTimerRef.current) {
      window.clearTimeout(vulnerableGuideTimerRef.current);
      vulnerableGuideTimerRef.current = null;
    }
  }, []);

  /** 테스트 지도: 안양 고정. 탐색(explore) 모드: 지도에 맞춘 중심. 내 위치 모드: GPS(없으면 탐색 중심) */
  const livePhotoMapCenter = useMemo((): [number, number] => {
    if (simOn) return ADMIN_MAP_TEST_VIRTUAL_CENTER;
    if (locationMode === 'explore') return exploreCenter;
    return myLocation ?? exploreCenter;
  }, [simOn, locationMode, exploreCenter, myLocation]);
  /** 지도 핀·플라이·AI 앵커 — 테스트 모드에선 GPS와 무관하게 안양 고정 */
  const mapDisplayMyLocation = useMemo((): [number, number] | null => (simOn ? ADMIN_MAP_TEST_VIRTUAL_CENTER : myLocation), [
    simOn,
    myLocation,
  ]);

  /** SOS·부모: DB 동기와 별개로 지도에 찍힌 내 좌표 전달(실시간 홀드 포함) */
  useEffect(() => {
    if (!mapDisplayMyLocation) {
      onMapClientMyLocationChange(null);
      return;
    }
    onMapClientMyLocationChange({ lat: mapDisplayMyLocation[0], lng: mapDisplayMyLocation[1] });
  }, [mapDisplayMyLocation, onMapClientMyLocationChange]);

  /** 실제 모드 상단 — 프리셋 지역 검색 */
  const [regionSearchQuery, setRegionSearchQuery] = useState('');
  const [regionSearchOpen, setRegionSearchOpen] = useState(false);
  const regionSearchBoxRef = useRef<HTMLDivElement | null>(null);

  const regionSearchHits = useMemo(
    () => matchExploreRegionPresets(regionSearchQuery),
    [regionSearchQuery],
  );

  const applyExploreFromSearch = useCallback(
    (p: ExploreRegionPreset) => {
      setExploreCenter(p.center);
      onExploreAnchorCommit(p.center);
      setRegionPickVersion((v) => v + 1);
      setPendingRouteCenter(p.center);
      onExplorePicked?.();
      setRegionSearchQuery('');
      setRegionSearchOpen(false);
    },
    [onExploreAnchorCommit, onExplorePicked],
  );

  useEffect(() => {
    if (!regionSearchOpen) return;
    const onDocDown = (e: MouseEvent) => {
      const el = regionSearchBoxRef.current;
      if (el && !el.contains(e.target as Node)) setRegionSearchOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [regionSearchOpen]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(id);
  }, [mapMinimalChrome]);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const clearLastKnownHoldTimer = useCallback(() => {
    if (lastKnownHoldTimerRef.current !== null) {
      window.clearTimeout(lastKnownHoldTimerRef.current);
      lastKnownHoldTimerRef.current = null;
    }
  }, []);

  const clearGpsReconnectInterval = useCallback(() => {
    if (gpsReconnectIntervalRef.current !== null) {
      window.clearInterval(gpsReconnectIntervalRef.current);
      gpsReconnectIntervalRef.current = null;
    }
  }, []);

  const bumpLastKnownHoldTimer = useCallback(() => {
    if (lastKnownHoldTimerRef.current !== null) {
      window.clearTimeout(lastKnownHoldTimerRef.current);
    }
    lastKnownHoldTimerRef.current = window.setTimeout(() => {
      lastKnownHoldTimerRef.current = null;
      stopLiveLocationRef.current();
    }, LAST_KNOWN_MARKER_HOLD_MS);
  }, []);

  const stopLiveLocation = useCallback(() => {
    clearLastKnownHoldTimer();
    clearGpsReconnectInterval();
    clearWatch();
    lastStableGpsRef.current = null;
    setGpsStreaming(false);
    setLiveTracking(false);
    setMyLocation(null);
    setLocateUi('idle');
  }, [clearWatch, clearGpsReconnectInterval, clearLastKnownHoldTimer]);

  stopLiveLocationRef.current = stopLiveLocation;

  useEffect(() => () => clearWatch(), [clearWatch]);

  useEffect(() => {
    if (!isActive && liveTracking) {
      stopLiveLocation();
    }
  }, [isActive, liveTracking, stopLiveLocation]);

  /** 관리자 테스트 지도 ON: GPS 대신 안양 관평로 고정을 「내 위치」로 둠. OFF 시 추적 해제 */
  useEffect(() => {
    if (simOn) {
      clearLastKnownHoldTimer();
      clearGpsReconnectInterval();
      clearWatch();
      setGpsStreaming(false);
      lastStableGpsRef.current = ADMIN_MAP_TEST_VIRTUAL_CENTER;
      setMyLocation(ADMIN_MAP_TEST_VIRTUAL_CENTER);
      setLiveTracking(true);
      setLocateUi('tracking');
      return;
    }
    clearLastKnownHoldTimer();
    clearGpsReconnectInterval();
    clearWatch();
    setGpsStreaming(false);
    lastStableGpsRef.current = null;
    setLiveTracking(false);
    setMyLocation(null);
    setLocateUi('idle');
  }, [simOn, clearWatch, clearGpsReconnectInterval, clearLastKnownHoldTimer]);

  /** 1분마다 driftTick 증가 → points 재생성으로 점들이 조금씩 이동 (테스트 모드만) */
  useEffect(() => {
    if (!simOn) return;
    const id = setInterval(() => setDriftTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [simOn]);

  /** 테스트 모드: 가상 인구 미세 움직임 — 느린 갱신(벌레·달리기 느낌 완화) */
  useEffect(() => {
    if (!simOn) return;
    const id = window.setInterval(() => {
      setSimWanderTick((n) => (n >= 9_999_999 ? 0 : n + 1));
    }, 420);
    return () => clearInterval(id);
  }, [simOn]);

  /** 오버레이 원 심장 박동 스케일 (가끔 살짝 커졌다 작아짐) */
  const [hbTick, setHbTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setHbTick((t) => t + 1), 95);
    return () => clearInterval(id);
  }, []);
  const hb = useMemo(() => {
    const ph = (hbTick * 0.11) % (Math.PI * 2);
    const beat = Math.pow(Math.max(0, Math.sin(ph)), 2.05);
    const dub = Math.pow(Math.max(0, Math.sin(ph * 2.05 + 0.45)), 1.85);
    return 1 + 0.058 * beat + 0.032 * dub;
  }, [hbTick]);

  /** 마이에서 지역 확정 시 중심 이동(seq만 감시 — 지도에서 anchor만 바꿀 때는 여기서 다시 fly 하지 않음) */
  useEffect(() => {
    if (exploreJumpSeq < 1) return;
    setExploreCenter(exploreAnchor);
    setRegionPickVersion((v) => v + 1);
    // exploreAnchor는 seq 증가와 같은 틱에서 갱신됨
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exploreJumpSeq 전용
  }, [exploreJumpSeq]);

  const viNeighborAnchor = useMemo(() => {
    const p = mapDisplayMyLocation;
    if (p) return { lat: p[0], lng: p[1] };
    return { lat: exploreCenter[0], lng: exploreCenter[1] };
  }, [mapDisplayMyLocation, exploreCenter]);

  /** 취약계층(시각장애인) 데모 마커 근접 시 진동·짧은 알림음 — 4시간당 1회 */
  useEffect(() => {
    if (mapMinimalChrome || zoomLevel < 13) return;
    const me = mapDisplayMyLocation;
    if (!me) return;
    const t = simWanderTick * 0.018;
    const vpLat = me[0] + 0.0006 + Math.sin(t * 0.7 + 0.3) * 0.000018;
    const vpLng = me[1] - 0.0009 + Math.cos(t * 0.5 + 1.1) * 0.000024;
    const dist = haversineMeters({ lat: me[0], lng: me[1] }, { lat: vpLat, lng: vpLng });
    if (dist > 135) return;
    const key = 'spotvibe_vi_prox_alert_ts';
    const now = Date.now();
    const last = Number(sessionStorage.getItem(key) || '0');
    if (now - last < 4 * 60 * 60 * 1000) return;
    sessionStorage.setItem(key, String(now));
    if (navigator.vibrate) navigator.vibrate([160, 80, 160, 80, 280]);
    playViProximityAlertTone();
  }, [zoomLevel, mapMinimalChrome, mapDisplayMyLocation, simWanderTick]);

  const startLiveLocation = useCallback(() => {
    if (!isActive) return;
    if (simOn) {
      clearLastKnownHoldTimer();
      clearGpsReconnectInterval();
      clearWatch();
      lastStableGpsRef.current = ADMIN_MAP_TEST_VIRTUAL_CENTER;
      setMyLocation(ADMIN_MAP_TEST_VIRTUAL_CENTER);
      setLiveTracking(true);
      setLocateUi('tracking');
      return;
    }
    if (!navigator.geolocation) {
      setLocateUi('unsupported');
      return;
    }
    clearLastKnownHoldTimer();
    clearGpsReconnectInterval();
    setLocateUi('loading');
    const WATCH_MIN_MS = 1200;
    const MIN_MOVE_M = 7;
    const watchOpts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 4000,
      timeout: 20000,
    };
    const readOpts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
    };

    const applyFreshReading = (plat: number, plng: number, respectMinMove: boolean) => {
      if (!isValidGeoLatLng(plat, plng)) return;
      bumpLastKnownHoldTimer();
      const candidate: [number, number] = [plat, plng];
      const prev = lastStableGpsRef.current;
      if (
        respectMinMove &&
        prev &&
        haversineMeters({ lat: prev[0], lng: prev[1] }, { lat: candidate[0], lng: candidate[1] }) <
          MIN_MOVE_M
      ) {
        return;
      }
      watchEmitAtRef.current = Date.now();
      lastStableGpsRef.current = candidate;
      setMyLocation(candidate);
    };

    const wireWatch = () => {
      clearGpsReconnectInterval();
      clearWatch();
      watchEmitAtRef.current = Date.now();
      watchIdRef.current = navigator.geolocation!.watchPosition(
        (p) => {
          const plat = p.coords.latitude;
          const plng = p.coords.longitude;
          if (!isValidGeoLatLng(plat, plng)) return;
          bumpLastKnownHoldTimer();
          const now = Date.now();
          if (now - watchEmitAtRef.current < WATCH_MIN_MS) return;
          const candidate: [number, number] = [plat, plng];
          const prev = lastStableGpsRef.current;
          if (
            prev &&
            haversineMeters(
              { lat: prev[0], lng: prev[1] },
              { lat: candidate[0], lng: candidate[1] },
            ) < MIN_MOVE_M
          )
            return;
          watchEmitAtRef.current = now;
          lastStableGpsRef.current = candidate;
          setMyLocation(candidate);
        },
        () => {
          clearWatch();
          watchIdRef.current = null;
          setGpsStreaming(false);
          setLocateUi('tracking');
          const tryRecover = () => {
            navigator.geolocation!.getCurrentPosition(
              (p) => {
                applyFreshReading(p.coords.latitude, p.coords.longitude, false);
                setGpsStreaming(true);
                setLocateUi('tracking');
                wireWatch();
              },
              () => {},
              readOpts,
            );
          };
          if (gpsReconnectIntervalRef.current === null) {
            tryRecover();
            gpsReconnectIntervalRef.current = window.setInterval(
              tryRecover,
              GPS_RECONNECT_INTERVAL_MS,
            );
          }
        },
        watchOpts,
      );
      setGpsStreaming(true);
    };

    const onSuccess = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!isValidGeoLatLng(lat, lng)) {
        setLiveTracking(false);
        setGpsStreaming(false);
        setLocateUi('denied');
        return;
      }
      const next: [number, number] = [lat, lng];
      lastStableGpsRef.current = next;
      setMyLocation(next);
      setLiveTracking(true);
      setLocateUi('tracking');
      bumpLastKnownHoldTimer();
      wireWatch();
    };
    const onError = () => {
      setLiveTracking(false);
      setGpsStreaming(false);
      setLocateUi('denied');
    };
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  }, [
    bumpLastKnownHoldTimer,
    clearGpsReconnectInterval,
    clearLastKnownHoldTimer,
    clearWatch,
    isActive,
    simOn,
  ]);

  const toggleMyLocation = useCallback(() => {
    if (liveTracking) {
      stopLiveLocation();
      return;
    }
    startLiveLocation();
  }, [liveTracking, startLiveLocation, stopLiveLocation]);

  /** 지도에서 위치 공유 ON일 때만 타인 점·DB 갱신 허용(부모) — 실시간 스트림 중에만 DB 반영 */
  const mapLocationShareActive = gpsStreaming || simOn;
  useEffect(() => {
    onMapLocationShareActiveChange(mapLocationShareActive);
  }, [mapLocationShareActive, onMapLocationShareActiveChange]);

  const clusterCenter = useMemo((): [number, number] => {
    return [
      exploreCenter[0] + CLUSTER_OFFSET_FROM_INITIAL[0],
      exploreCenter[1] + CLUSTER_OFFSET_FROM_INITIAL[1],
    ];
  }, [exploreCenter]);

  /** 현재 exploreCenter에서 가장 가까운 프리셋 지역 (500m 이내) */
  const nearestRegionId = useMemo(() => {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const p of EXPLORE_REGION_PRESETS) {
      const d = Math.hypot(exploreCenter[0] - p.center[0], exploreCenter[1] - p.center[1]);
      if (d < bestDist) { bestDist = d; best = p.id; }
    }
    // 0.05도(약 5km) 이내일 때만 적용, 아니면 null
    return bestDist < 0.05 ? best : null;
  }, [exploreCenter]);

  const eventMarkersShifted = useMemo(() => {
    // 지역 고정 마커: 해당 regionId가 현재 지역이면 그대로 표시
    const fixed = EVENT_MARKERS.filter((ev) =>
      nearestRegionId ? ev.regionId === nearestRegionId : ev.regionId === 'hongdae'
    );
    return fixed;
  }, [nearestRegionId]);

  const [aiSpotIndex, setAiSpotIndex] = useState(0);
  const [aiNudgeVisible, setAiNudgeVisible] = useState(false);
  const [aiPhraseFlip, setAiPhraseFlip] = useState(0);
  const aiCountRef = useRef(1);

  const aiCandidates = useMemo((): AiNudgeSpot[] => {
    if (!simOn) return [];
    if (eventMarkersShifted.length > 0) {
      return eventMarkersShifted.map((ev) => ({
        id: ev.id,
        position: [ev.position[0], ev.position[1]] as [number, number],
        title: ev.label,
        emoji: ev.emoji,
        accent: ev.accent,
      }));
    }
    return syntheticNudgeSpots(exploreCenter);
  }, [simOn, eventMarkersShifted, exploreCenter]);

  const aiCandidatesSafe = useMemo(() => {
    if (!simOn) return [] as AiNudgeSpot[];
    return aiCandidates.length > 0 ? aiCandidates : syntheticNudgeSpots(exploreCenter);
  }, [simOn, aiCandidates, exploreCenter]);

  const aiCandidateCount = aiCandidatesSafe.length;
  aiCountRef.current = Math.max(1, aiCandidateCount);
  const activeAiPick =
    aiCandidateCount > 0 ? aiCandidatesSafe[aiSpotIndex % aiCandidateCount] : null;

  useEffect(() => {
    setAiSpotIndex(0);
  }, [nearestRegionId]);

  /** 가끔만 말풍선 표시 · 숨김 34–58초 / 노출 18–28초 (스팟 순서는 아래 타이머로 별도 갱신) */
  useEffect(() => {
    if (!simOn || aiCandidateCount < 1) {
      setAiNudgeVisible(false);
      return;
    }
    let cancelled = false;
    let tid: ReturnType<typeof setTimeout>;
    const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

    const scheduleHidden = (showMs: number) => {
      tid = setTimeout(() => {
        if (cancelled) return;
        setAiNudgeVisible(false);
        scheduleShowGap(rnd(34000, 58000));
      }, showMs);
    };

    const scheduleShowGap = (gapMs: number) => {
      tid = setTimeout(() => {
        if (cancelled) return;
        setAiNudgeVisible(true);
        scheduleHidden(rnd(18000, 28000));
      }, gapMs);
    };

    scheduleShowGap(rnd(5000, 12000));
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [simOn, nearestRegionId, aiCandidateCount]);

  /** 30–60초마다 다음 추천 스팟 + '여기 어때?' / '여기는?' 문구 교대 */
  useEffect(() => {
    if (!simOn || aiCandidateCount < 1) return;
    let cancelled = false;
    let tid: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      tid = setTimeout(() => {
        if (cancelled) return;
        setAiSpotIndex((i) => (i + 1) % aiCountRef.current);
        setAiPhraseFlip((f) => f + 1);
        scheduleNext();
      }, 30000 + Math.floor(Math.random() * 30001));
    };
    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [simOn, aiCandidateCount]);

  const personalizedTail = useMemo(
    () => buildPersonalizedTail(genderPref, activityTags, mbtiSet, bloodTypeSet),
    [genderPref, activityTags, mbtiSet, bloodTypeSet],
  );

  /** AI 추천 스팟 + 화살표 인도 (앵커: GPS 있으면 내 위치, 없으면 탐색 중심) */
  const aiGuide = useMemo(() => {
    if (!activeAiPick) return null;
    const anchor: [number, number] = mapDisplayMyLocation ?? exploreCenter;
    let spot: [number, number] = [activeAiPick.position[0], activeAiPick.position[1]];
    let d = Math.hypot(spot[0] - anchor[0], spot[1] - anchor[1]);
    if (d < 0.00032) {
      spot = [anchor[0] + 0.00042, anchor[1] + 0.00026];
      d = Math.hypot(spot[0] - anchor[0], spot[1] - anchor[1]);
    }
    const bearing = bearingDegrees(anchor, spot);
    const arrowAt = interpLatLng(anchor, spot, 0.34);
    return { anchor, spot, bearing, arrowAt, dist: d, pickId: activeAiPick.id };
  }, [mapDisplayMyLocation, exploreCenter, activeAiPick]);

  const aiBlurb = useMemo(
    () => (activeAiPick ? buildBlurbLine(activeAiPick, personalizedTail) : ''),
    [activeAiPick, personalizedTail],
  );

  const aiHeadline = aiPhraseFlip % 2 === 0 ? '✨ 여기 어때?' : '📍 여기는?';

  const aiArrowHintLine = useMemo(() => {
    if (!activeAiPick) return '';
    return `이쪽 → ${pinLabelTwo(activeAiPick.title)}`;
  }, [activeAiPick]);

  const aiDestIcon = useMemo(() => {
    if (!activeAiPick) return null;
    return aiNudgeDestinationIcon({
      headline: aiHeadline,
      placeTitle: `${activeAiPick.emoji} ${pinLabelTwo(activeAiPick.title)}`,
      blurb: aiBlurb,
      accent: activeAiPick.accent,
    });
  }, [aiHeadline, activeAiPick, aiBlurb]);

  const aiArrowHintIcon = useMemo(() => {
    if (!aiGuide) return null;
    return aiNudgeArrowHintIcon(aiGuide.bearing, aiArrowHintLine);
  }, [aiGuide, aiArrowHintLine]);

  const meGpsIcon = useMemo(() => meAtCenterIcon(true), []);
  const meExploreIcon = useMemo(() => meAtCenterIcon(false), []);

  /* ── 활성 AI 추천 (버튼 탭) ─────────────────────── */
  const [activeRecIdx, setActiveRecIdx] = useState<number | null>(null);
  const [recCountdown, setRecCountdown] = useState(AI_REC_COUNTDOWN_SEC);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const aiRecAllowedRegionIds = useMemo(
    () => aiInsightPresetIdsForAnchorPreset(nearestRegionId),
    [nearestRegionId],
  );

  const rankedRecs = useMemo(() => {
    if (!simOn) return [] as AiRec[];
    return sortedAiRecs(
      AI_REC_POOL.filter((r) => aiRecAllowedRegionIds.has(r.regionId)),
      genderPref,
      activityTags,
      mbtiSet,
      bloodTypeSet,
    );
  }, [simOn, aiRecAllowedRegionIds, genderPref, activityTags, mbtiSet, bloodTypeSet]);

  const stopRecTimer = useCallback(() => {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
  }, []);

  const startRecTimer = useCallback(() => {
    stopRecTimer();
    setRecCountdown(AI_REC_COUNTDOWN_SEC);
    recTimerRef.current = setInterval(() => {
      setRecCountdown((c) => {
        if (c <= 1) {
          stopRecTimer();
          setActiveRecIdx(null);
          return AI_REC_COUNTDOWN_SEC;
        }
        return c - 1;
      });
    }, 1000);
  }, [stopRecTimer]);

  const handleAiRecButton = useCallback(() => {
    if (rankedRecs.length === 0) return;
    setActiveRecIdx((prev) => {
      const next = prev === null ? 0 : (prev + 1) % rankedRecs.length;
      return next;
    });
    startRecTimer();
  }, [rankedRecs.length, startRecTimer]);

  const handleDismissRec = useCallback(() => {
    stopRecTimer();
    setActiveRecIdx(null);
    setRecCountdown(AI_REC_COUNTDOWN_SEC);
  }, [stopRecTimer]);

  useEffect(() => () => stopRecTimer(), [stopRecTimer]);

  /** 실제 모드로 바꾸면 데모 추천 UI 정리 */
  useEffect(() => {
    if (simOn) return;
    stopRecTimer();
    setActiveRecIdx(null);
    setRecCountdown(AI_REC_COUNTDOWN_SEC);
  }, [simOn, stopRecTimer]);

  const activeRec = activeRecIdx !== null ? rankedRecs[activeRecIdx] ?? null : null;

  const activeRecPinIcon = useMemo(
    () =>
      activeRec
        ? aiActivePinIcon(activeRec.accent, activeRec.emoji, activeRec.title)
        : null,
    [activeRec],
  );

  const recAnchor = useMemo<[number, number]>(
    () => mapDisplayMyLocation ?? exploreCenter,
    [mapDisplayMyLocation, exploreCenter],
  );

  const recGuide = useMemo(() => {
    if (!activeRec) return null;
    const spot: [number, number] = [activeRec.position[0], activeRec.position[1]];
    const d = Math.hypot(spot[0] - recAnchor[0], spot[1] - recAnchor[1]);
    const bearing = bearingDegrees(recAnchor, spot);
    const arrowAt = interpLatLng(recAnchor, spot, 0.42);
    return { spot, bearing, arrowAt, dist: d };
  }, [activeRec, recAnchor]);

  useEffect(() => {
    setMapReady(true);
  }, []);

  const handleZoomChange = useCallback((z: number) => {
    setZoomLevel(z);
  }, []);

  const points20 = useMemo(
    () =>
      randomPointsInDisk(
        exploreCenter[0] + 0.0008,
        exploreCenter[1] + 0.0018,
        Math.max(16, Math.round(35 * (0.55 + 0.45 * crowdTight))),
        1001 + driftTick * 17,
        0.55 * crowdTight,
      ),
    [exploreCenter, driftTick, crowdTight],
  );
  const points30 = useMemo(
    () =>
      randomPointsInDisk(
        exploreCenter[0] - 0.0004,
        exploreCenter[1] - 0.0018,
        Math.max(12, Math.round(25 * (0.55 + 0.45 * crowdTight))),
        2002 + driftTick * 23,
        0.42 * crowdTight,
      ),
    [exploreCenter, driftTick, crowdTight],
  );
  const points40 = useMemo(
    () =>
      randomPointsInDisk(
        clusterCenter[0],
        clusterCenter[1],
        Math.max(22, Math.round(45 * (0.55 + 0.45 * crowdTight))),
        3003 + driftTick * 31,
        0.22 * crowdTight,
      ),
    [clusterCenter, driftTick, crowdTight],
  );

  const icons = useMemo(
    () => Object.fromEntries(
      EVENT_MARKERS.map((ev) => [ev.id, eventDivIcon(pinLabelTwo(ev.label), ev.accent, ev.emoji)])
    ),
    [],
  );

  /** 줌에 따라 점 크기 — 살짝 작게·옅게(핀·경로가 앞으로) */
  const userDotRadius = useMemo(
    () => Math.max(2.2, Math.min(5.2, (3.2 + (zoomLevel - 11) * 0.28)) * 0.88),
    [zoomLevel],
  );

  if (!mapReady) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#12121A] text-white/40 text-sm">
        지도 로딩…
      </div>
    );
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-0 bg-[#12121A] [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#0A0A0E] [&_.leaflet-bottom.leaflet-left]:ml-2 [&_.leaflet-control-zoom]:overflow-hidden [&_.leaflet-control-zoom]:rounded-xl [&_.leaflet-control-zoom]:border [&_.leaflet-control-zoom]:border-white/12 [&_.leaflet-control-zoom]:bg-[#1A1A24]/95 [&_.leaflet-control-zoom]:shadow-lg [&_.leaflet-control-zoom-in]:text-white [&_.leaflet-control-zoom-out]:text-white [&_.leaflet-control-zoom-in]:leading-none [&_.leaflet-control-zoom-out]:leading-none [&_.leaflet-control-zoom-in:hover]:bg-white/10 [&_.leaflet-control-zoom-out:hover]:bg-white/10 [&_.leaflet-control-attribution]:max-w-[55%] [&_.leaflet-control-attribution]:truncate [&_.leaflet-control-attribution]:text-[9px] [&_.leaflet-control-attribution]:text-white/40 [&_.leaflet-control-attribution]:bg-black/40',
        mapMinimalChrome
          ? '[&_.leaflet-bottom.leaflet-left]:mb-2'
          : '[&_.leaflet-bottom.leaflet-left]:mb-[7.25rem]',
      )}
    >
      <MapContainer
        center={exploreCenter}
        zoom={INITIAL_ZOOM}
        minZoom={11}
        maxZoom={18}
        scrollWheelZoom
        dragging
        doubleClickZoom
        touchZoom
        zoomControl={false}
        /** DivIcon+CSS transform 링이 줌 보간과 겹칠 때 깜빡임 완화 */
        markerZoomAnimation={false}
        className="h-full w-full"
        style={{ background: '#0A0A0E' }}
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_DARK_MATTER} />
        <MapInvalidateOnResize />
        {/* 상단 SpotVibe 헤더·+/- 겹침 방지: 줌은 좌하단 + 탭바 여백 */}
        <ZoomLevelTracker onZoomChange={handleZoomChange} />
        <MapSyncToMyLocation
          center={mapDisplayMyLocation}
          zoom={16}
          followEnabled={liveTracking && locationMode === 'my_location'}
        />
        <MapFlyToExploreOnPick center={exploreCenter} pickVersion={regionPickVersion} />

        {/* MBTI 집합 오버레이 — 테스트 모드만 (가상 필터 시각화) */}
        {simOn && mbtiSet && mbtiSet.size > 0 && Array.from(mbtiSet).map((type) => {
          const ov = MBTI_OVERLAY[type];
          if (!ov) return null;
          const center: [number, number] = [
            exploreCenter[0] + ov.offset[0],
            exploreCenter[1] + ov.offset[1],
          ];
          return (
            <Circle
              key={type}
              center={center}
              radius={ov.radiusM * hb * crowdTight}
              pathOptions={{
                color: ov.color,
                weight: 1,
                opacity: 0.35,
                fillColor: ov.color,
                fillOpacity: 0.045,
              }}
            />
          );
        })}

        {/* 혈액형 오버레이 — 테스트 모드만 */}
        {simOn && bloodTypeSet && bloodTypeSet.size > 0 && Array.from(bloodTypeSet).map((bt) => {
          const ov = BLOOD_TYPE_OVERLAY[bt];
          if (!ov) return null;
          const center: [number, number] = [
            exploreCenter[0] + ov.offset[0],
            exploreCenter[1] + ov.offset[1],
          ];
          return (
            <Circle
              key={`blood_${bt}`}
              center={center}
              radius={ov.radiusM * hb * crowdTight}
              pathOptions={{
                color: ov.color,
                weight: 1,
                opacity: 0.3,
                fillColor: ov.color,
                fillOpacity: 0.04,
              }}
            />
          );
        })}

        {/* 성별 인파 — 테스트 모드만 (마이 연령 팔레트와 동기) */}
        {simOn && genderPref === 'all' && (
          <Circle
            center={exploreCenter}
            radius={268 * hb * crowdTight}
            pathOptions={{
              color: `${profilePal.male}55`,
              weight: 1,
              opacity: 0.42,
              fillColor: profilePal.accent,
              fillOpacity: 0.038,
            }}
          />
        )}
        {simOn && genderPref === 'female_crowd' && (
          <Circle
            center={[exploreCenter[0] + 0.0008, exploreCenter[1] + 0.0018] as [number, number]}
            radius={280 * hb * crowdTight}
            pathOptions={{
              color: profilePal.female,
              weight: 1,
              opacity: 0.38,
              fillColor: profilePal.female,
              fillOpacity: 0.04,
            }}
          />
        )}
        {simOn && genderPref === 'male_crowd' && (
          <Circle
            center={[exploreCenter[0] - 0.0004, exploreCenter[1] - 0.0018] as [number, number]}
            radius={248 * hb * crowdTight}
            pathOptions={{
              color: profilePal.male,
              weight: 1,
              opacity: 0.38,
              fillColor: profilePal.male,
              fillOpacity: 0.04,
            }}
          />
        )}

        {/* 활동 태그 — 테스트 모드만 */}
        {simOn && activityTags && Array.from(activityTags).map((tag) => {
          const ov = ACTIVITY_OVERLAY[tag];
          if (!ov) return null;
          const center: [number, number] = [
            exploreCenter[0] + ov.offset[0],
            exploreCenter[1] + ov.offset[1],
          ];
          return (
            <Circle
              key={tag}
              center={center}
              radius={ov.radiusM * hb * crowdTight}
              pathOptions={{
                color: ov.color,
                weight: 1,
                opacity: 0.4,
                fillColor: ov.color,
                fillOpacity: 0.048,
              }}
            />
          );
        })}

        {/* 40대+ 밀집 클릭 영역 — 테스트 모드만 (가상 클러스터) */}
        {simOn && (
          <Circle
            center={clusterCenter}
            radius={200 * hb * crowdTight}
            pathOptions={{
              color: M40.accent,
              weight: 1,
              opacity: 0.42,
              fillColor: M40.accent,
              fillOpacity: 0.075,
              className: 'cursor-pointer',
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onClusterClick();
              },
            }}
          />
        )}

        {simOn && points20.map((pos, i) => {
          const c = crowdDotColorForGenderPref('20대', i, genderPref);
          const [wLat, wLng] = virtualCrowdMotionDelta(i, 20, simWanderTick, pos[0], pos[1], exploreCenter);
          return (
            <CircleMarker
              key={`20-${i}`}
              center={[pos[0] + wLat, pos[1] + wLng]}
              radius={userDotRadius}
              pathOptions={{
                color: c,
                fillColor: c,
                fillOpacity: 0.36,
                weight: 0.5,
                opacity: 0.55,
              }}
            />
          );
        })}
        {simOn && points30.map((pos, i) => {
          const c = crowdDotColorForGenderPref('30대', i, genderPref);
          const [wLat, wLng] = virtualCrowdMotionDelta(i, 30, simWanderTick, pos[0], pos[1], exploreCenter);
          return (
            <CircleMarker
              key={`30-${i}`}
              center={[pos[0] + wLat, pos[1] + wLng]}
              radius={userDotRadius}
              pathOptions={{
                color: c,
                fillColor: c,
                fillOpacity: 0.36,
                weight: 0.5,
                opacity: 0.55,
              }}
            />
          );
        })}
        {simOn && points40.map((pos, i) => {
          const c = crowdDotColorForGenderPref('40대', i, genderPref);
          const [wLat, wLng] = virtualCrowdMotionDelta(i, 40, simWanderTick, pos[0], pos[1], exploreCenter);
          return (
            <CircleMarker
              key={`40-${i}`}
              center={[pos[0] + wLat, pos[1] + wLng]}
              radius={userDotRadius}
              pathOptions={{
                color: c,
                fillColor: c,
                fillOpacity: 0.4,
                weight: 0.5,
                opacity: 0.58,
              }}
            />
          );
        })}

        {/* 내 위치 GPS가 켜져 있으면 탐색 중심 점과 내 마커가 같은 좌표로 겹쳐 이중처럼 보이므로 생략 */}
        {!(locationMode === 'my_location' && mapDisplayMyLocation) && (
          <CircleMarker
            center={exploreCenter}
            radius={3.2 + 1.4 * (hb - 1)}
            pathOptions={{
              color: profilePal.accent,
              fillColor: profilePal.accent,
              fillOpacity: 0.16 + 0.08 * (hb - 1),
              weight: 1,
              opacity: 0.45,
              dashArray: '5 6',
            }}
          />
        )}

        {/* ── 실제 모드: 근처 이용자 점(3.0에서는 데이터 미사용) ── */}
        {!simOn && matchedUsers.map((u) => {
          const pal = getAgeGenderColors(u.ageRange ?? undefined);
          const dotColor = u.gender === '여성' ? pal.female
            : u.gender === '남성' ? pal.male
            : pal.accent;
          // matchScore가 높을수록 조금 더 크고 밝게
          const r = Math.min(7, userDotRadius * (1 + Math.min(u.matchScore, 8) * 0.08));
          const opacity = Math.min(0.95, 0.5 + u.matchScore * 0.05);
          return (
            <CircleMarker
              key={`real-${u.id}`}
              center={[u.lat, u.lng]}
              radius={r}
              pathOptions={{
                color: dotColor,
                fillColor: dotColor,
                fillOpacity: opacity,
                weight: 1,
                opacity: opacity,
              }}
            />
          );
        })}

        {simOn && eventMarkersShifted.map((ev) => (
          <Marker
            key={ev.id}
            position={ev.position}
            icon={icons[ev.id]}
          />
        ))}

        <MePositionLayers
          myLocation={mapDisplayMyLocation}
          exploreCenter={exploreCenter}
          gpsIcon={meGpsIcon}
          exploreIcon={meExploreIcon}
        />

        {/* AI 말풍선 인도 — 테스트 모드·후보만 */}
        {simOn && aiNudgeVisible && aiGuide && aiDestIcon && aiArrowHintIcon && aiGuide.dist > 1e-7 && (
          <>
            <Polyline
              positions={[aiGuide.anchor, aiGuide.spot]}
              pathOptions={{
                color: '#00F0FF',
                weight: 3,
                opacity: 0.68,
                dashArray: '10 14',
                lineCap: 'round',
              }}
            />
            <Marker
              key={`ai-arr-${aiGuide.pickId}-${aiPhraseFlip}`}
              position={aiGuide.arrowAt}
              icon={aiArrowHintIcon}
              zIndexOffset={650}
            />
            <Marker
              key={`ai-dest-${aiGuide.pickId}-${aiPhraseFlip}`}
              position={aiGuide.spot}
              icon={aiDestIcon}
              zIndexOffset={720}
            />
          </>
        )}

        {/* 활성 AI 추천 — 테스트 모드·데모 풀만 */}
        {simOn && activeRec && recGuide && recGuide.dist > 1e-7 && (
          <>
            <Polyline
              key={`rec-line-${activeRec.id}`}
              positions={[recAnchor, recGuide.spot]}
              pathOptions={{
                color: activeRec.accent,
                weight: 3.5,
                opacity: 0.82,
                dashArray: '8 10',
                lineCap: 'round',
              }}
            />
            <Marker
              key={`rec-arrow-${activeRec.id}`}
              position={recGuide.arrowAt}
              zIndexOffset={750}
              icon={aiNudgeArrowHintIcon(recGuide.bearing, `→ ${pinLabelTwo(activeRec.title)}`)}
            />
            <Marker
              key={`rec-pin-${activeRec.id}`}
              position={recGuide.spot}
              icon={activeRecPinIcon!}
              zIndexOffset={820}
            />
          </>
        )}

        {/* ─── 취약계층 마커 — 버튼 없이 항상 표시 (zoom ≥ 13), 실시간 위치 드리프트 ─── */}
        {zoomLevel >= 13 && (() => {
          const c = mapDisplayMyLocation ?? exploreCenter;
          const t = simWanderTick * 0.018;
          /* 각 마커마다 다른 주기·방향으로 천천히 이동 (실제 GPS 갱신 시뮬레이션) */
          const VULNERABLE = [
            {
              id: 'vp1', emoji: '🦯', color: '#60A5FA', label: '시각장애인',
              lat: c[0] + 0.0006 + Math.sin(t * 0.7 + 0.3) * 0.000018,
              lng: c[1] - 0.0009 + Math.cos(t * 0.5 + 1.1) * 0.000024,
            },
            {
              id: 'vp2', emoji: '♿', color: '#FCD34D', label: '이동약자',
              lat: c[0] - 0.0009 + Math.sin(t * 0.4 + 2.1) * 0.000012,
              lng: c[1] + 0.0007 + Math.cos(t * 0.6 + 0.8) * 0.000016,
            },
          ];
          return VULNERABLE.map((v) => (
            <Marker
              key={v.id}
              position={[v.lat, v.lng]}
              icon={vulnerablePersonIcon(v.emoji, v.color, v.label)}
              zIndexOffset={600}
              eventHandlers={{ click: () => setViNeighborSendOpen(true) }}
            />
          ));
        })()}

        {/* ─── 소화기 레이어: 500m 반경 원 + 마커 ─── */}
        {/* ─── 소화기 레이어 ─── */}
        {activeFacilityLayer === 'fire' && (() => {
          const center = mapDisplayMyLocation ?? exploreCenter;
          const markers = facilityMarkers.filter((m) => m.type === 'fire' && !m.gone);
          return (
            <>
              <Circle center={center} radius={500}
                pathOptions={{ color: '#EF4444', weight: 1.5, opacity: 0.5, fillColor: '#EF4444', fillOpacity: 0.04, dashArray: '6 6' }} />
              {markers.map((dm) => (
                <Marker
                  key={dm.id}
                  position={[dm.lat, dm.lng]}
                  icon={facilityDivIcon(dm.emoji, '#EF4444', dm.label)}
                  zIndexOffset={980}
                  eventHandlers={{ click: () => setSelectedMarker({ ...dm }) }}
                />
              ))}
            </>
          );
        })()}
        {/* ─── 화장실 레이어 ─── */}
        {activeFacilityLayer === 'toilet' && (() => {
          const center = mapDisplayMyLocation ?? exploreCenter;
          const markers = facilityMarkers.filter((m) => m.type === 'toilet' && !m.gone);
          return (
            <>
              <Circle center={center} radius={500}
                pathOptions={{ color: '#22C55E', weight: 1.5, opacity: 0.5, fillColor: '#22C55E', fillOpacity: 0.04, dashArray: '6 6' }} />
              {markers.map((dm, idx) => (
                <Marker
                  key={dm.id}
                  position={dm.demoAroundCenter ? facilityDemoMapPosition(center, dm.id, idx) : [dm.lat, dm.lng]}
                  icon={facilityDivIconImg(
                    dm.mapIconSrc || TOILET_MAP_ICON,
                    '#22C55E',
                    dm.label,
                    TOILET_MAP_ICON,
                  )}
                  zIndexOffset={980}
                  eventHandlers={{ click: () => setSelectedMarker({ ...dm }) }}
                />
              ))}
            </>
          );
        })()}
        {/* ─── 야외 운동시설 레이어 ─── */}
        {activeFacilityLayer === 'gym' && (() => {
          const center = mapDisplayMyLocation ?? exploreCenter;
          const markers = facilityMarkers.filter((m) => m.type === 'gym' && !m.gone);
          return (
            <>
              <Circle center={center} radius={500}
                pathOptions={{ color: '#34D399', weight: 1.5, opacity: 0.5, fillColor: '#34D399', fillOpacity: 0.04, dashArray: '6 6' }} />
              {markers.map((dm, idx) => (
                <Marker
                  key={dm.id}
                  position={dm.demoAroundCenter ? facilityDemoMapPosition(center, dm.id, idx) : [dm.lat, dm.lng]}
                  icon={facilityDivIconImg(
                    dm.mapIconSrc || OUTDOOR_GYM_MAP_ICON,
                    '#34D399',
                    dm.label,
                    OUTDOOR_GYM_MAP_ICON,
                    { imgPx: 24, badgePx: 36 },
                  )}
                  zIndexOffset={980}
                  eventHandlers={{ click: () => setSelectedMarker({ ...dm }) }}
                />
              ))}
            </>
          );
        })()}
        {/* ─── 공공 쓰레기통 레이어 ─── */}
        {activeFacilityLayer === 'trash' && (() => {
          const center = mapDisplayMyLocation ?? exploreCenter;
          const markers = facilityMarkers.filter((m) => m.type === 'trash' && !m.gone);
          const ring = '#94A3B8';
          return (
            <>
              <Circle
                center={center}
                radius={500}
                pathOptions={{
                  color: ring,
                  weight: 1.5,
                  opacity: 0.5,
                  fillColor: ring,
                  fillOpacity: 0.04,
                  dashArray: '6 6',
                }}
              />
              {markers.map((dm, idx) => (
                <Marker
                  key={dm.id}
                  position={dm.demoAroundCenter ? facilityDemoMapPosition(center, dm.id, idx) : [dm.lat, dm.lng]}
                  icon={facilityDivIconImg(
                    dm.mapIconSrc || PUBLIC_TRASH_MAP_ICON,
                    ring,
                    dm.label,
                  )}
                  zIndexOffset={980}
                  eventHandlers={{ click: () => setSelectedMarker({ ...dm }) }}
                />
              ))}
            </>
          );
        })()}
        {/* ─── 흡연실 레이어 ─── */}
        {activeFacilityLayer === 'smoking' && (() => {
          const center = mapDisplayMyLocation ?? exploreCenter;
          const markers = facilityMarkers.filter((m) => m.type === 'smoking' && !m.gone);
          const ring = '#F59E0B';
          return (
            <>
              <Circle
                center={center}
                radius={500}
                pathOptions={{
                  color: ring,
                  weight: 1.5,
                  opacity: 0.5,
                  fillColor: ring,
                  fillOpacity: 0.04,
                  dashArray: '6 6',
                }}
              />
              {markers.map((dm, idx) => (
                <Marker
                  key={dm.id}
                  position={dm.demoAroundCenter ? facilityDemoMapPosition(center, dm.id, idx) : [dm.lat, dm.lng]}
                  icon={facilityDivIconImg(
                    dm.mapIconSrc || SMOKING_ROOM_MAP_ICON,
                    ring,
                    dm.label,
                    SMOKING_ROOM_MAP_ICON,
                    { imgPx: 26, badgePx: 38 },
                  )}
                  zIndexOffset={980}
                  eventHandlers={{ click: () => setSelectedMarker({ ...dm }) }}
                />
              ))}
            </>
          );
        })()}

        {/* ─── SOS 도움 신호 마커 — 내 위치 핀과 동일 계열(펄스·라벨), 유형별 아이콘 ─── */}
        {sosSignals.map((sig) => {
          const m = getSosTypeMeta(sig.signal_type);
          if (!m) return null;
          const opacity = sosOpacity(sig.expires_at);
          const icon = sosPeerMeStyleIcon(m, opacity, !!sig.photo_url);
          return (
            <React.Fragment key={sig.id}>
              <CircleMarker
                center={[sig.lat, sig.lng]}
                radius={18}
                pathOptions={{
                  color: m.color,
                  fillColor: m.color,
                  fillOpacity: 0.12 * Math.min(1, opacity + 0.15),
                  weight: 0,
                  opacity,
                }}
              />
              <Marker
                position={[sig.lat, sig.lng]}
                icon={icon}
                zIndexOffset={920}
                eventHandlers={{
                  click: () => {
                    if (myActiveSosSignalId && sig.id === myActiveSosSignalId) {
                      onSosOpen?.();
                    } else if (onSosPeerSelect) {
                      onSosPeerSelect(sig);
                    } else {
                      onSosOpen?.();
                    }
                  },
                }}
              />
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* 지역 확정 직후 — 기존 행동 지시 시트(네이버 길찾기) 연동 */}
      {!mapMinimalChrome && pendingRouteCenter && onOpenRouteSheetTo && (
        <div className="pointer-events-none absolute bottom-[7rem] left-0 right-0 z-[418] flex justify-center px-3">
          <div
            className="pointer-events-auto flex w-full max-w-md flex-col gap-2.5 rounded-2xl border p-3 shadow-xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor: 'rgba(0,240,255,0.4)',
              background: 'rgba(10,10,14,0.92)',
              boxShadow: '0 0 20px rgba(0,240,255,0.2)',
            }}
          >
            <p className="text-left text-[13px] font-semibold leading-snug text-white/88">
              이 위치까지 가는 경로를 볼까요?
              <span className="mt-0.5 block text-[11px] font-normal text-white/45">
                아래에서 네이버 지도 길찾기와 동일한 흐름이에요
              </span>
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setPendingRouteCenter(null)}
                className="rounded-xl border border-white/15 px-3 py-2.5 text-[12px] font-semibold text-white/50 transition-colors hover:bg-white/05"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  const info = explorePickRouteInfo(pendingRouteCenter);
                  onOpenRouteSheetTo(info.naverQuery, info.displayLabel);
                  setPendingRouteCenter(null);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[12px] font-bold text-[#00F0FF] transition-all active:scale-[0.98] sm:flex-initial"
                style={{
                  borderColor: 'rgba(0,240,255,0.55)',
                  backgroundColor: 'rgba(0,240,255,0.12)',
                  boxShadow: '0 0 14px rgba(0,240,255,0.25)',
                }}
              >
                <Navigation size={15} strokeWidth={2.2} />
                경로 보기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 내 위치 · 탐색 지역: UI 플로팅 (네비 바 위 z-index) */}
      {!mapMinimalChrome && (
      <div className="pointer-events-none absolute inset-0 z-[410]">

        {/* 지역 검색·탐색 패널 — 아래로 내려 FAB(카메라·갤러리)가 헤더와 검색 사이에 오도록 */}
        <div className="pointer-events-auto absolute left-0 right-0 top-[8rem] z-[412] flex justify-center px-3">
            <div ref={regionSearchBoxRef} className="flex w-full max-w-md flex-col gap-1">
            <div className="flex items-center gap-2 rounded-2xl border border-[#00F0FF]/28 bg-[#0A0A0E]/92 px-3 py-2 shadow-lg backdrop-blur-md">
              <Search size={17} className="shrink-0 text-[#00F0FF]/85" aria-hidden />
              <input
                type="search"
                enterKeyHint="go"
                value={regionSearchQuery}
                onChange={(e) => {
                  setRegionSearchQuery(e.target.value);
                  setRegionSearchOpen(true);
                }}
                onFocus={() => setRegionSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const q = regionSearchQuery.trim();
                  if (!q) return;
                  const hits = matchExploreRegionPresets(regionSearchQuery);
                  if (hits.length > 0) applyExploreFromSearch(hits[0]);
                }}
                placeholder="지역 검색 (예: 광안리, 홍대연남, 해운대)"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
                aria-label="지역 검색"
                aria-expanded={regionSearchOpen && (regionSearchHits.length > 0 || regionSearchQuery.trim().length > 0)}
                aria-controls="map-region-search-suggestions"
              />
              {regionSearchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRegionSearchQuery('');
                    setRegionSearchOpen(false);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/08 hover:text-white/75"
                  aria-label="검색어 지우기"
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              )}
            </div>
            {regionSearchOpen && regionSearchHits.length > 0 && (
              <ul
                id="map-region-search-suggestions"
                role="listbox"
                className="max-h-[min(42vh,300px)] overflow-y-auto rounded-xl border border-white/12 bg-[#12121a]/96 py-1 shadow-xl backdrop-blur-md"
              >
                {regionSearchHits.map((p) => (
                  <li key={p.id} role="option">
                    <button
                      type="button"
                      onClick={() => applyExploreFromSearch(p)}
                      className="w-full px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-white/90 transition-colors hover:bg-white/[0.07] active:bg-white/10"
                    >
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {regionSearchOpen && regionSearchQuery.trim().length > 0 && regionSearchHits.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-[#0A0A0E]/90 px-3 py-2.5 text-[11px] leading-snug text-white/45">
                등록된 지역과 맞는 곳이 없어요. 철자를 바꿔 보거나, 지도 왼쪽 아래 「지역」에서 목록을 열 수 있어요.
              </p>
            )}
            <ExploreRegionFlowPanel
              variant="map"
              explorePresets={EXPLORE_REGION_PRESETS}
              onApply={applyExploreFromSearch}
            />
            </div>
        </div>

        {/* ── AI 추천 카드 ── */}
        <AnimatePresence>
          {simOn && activeRec && (
            <motion.div
              key={`rec-card-${activeRec.id}`}
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="pointer-events-auto absolute bottom-[8.5rem] left-4 right-4 z-[420]"
            >
              <div
                className="overflow-hidden rounded-2xl border backdrop-blur-xl"
                style={{
                  borderColor: `${activeRec.accent}40`,
                  background: 'rgba(10,10,18,0.55)',
                  boxShadow: `0 0 0 1px ${activeRec.accent}18, 0 10px 28px rgba(0,0,0,0.4)`,
                }}
              >
                {/* 카운트다운 바 */}
                <div className="h-[3px] w-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: activeRec.accent }}
                    animate={{ width: `${(recCountdown / AI_REC_COUNTDOWN_SEC) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'linear' }}
                  />
                </div>

                <div className="px-4 pb-5 pt-4">
                  {/* 헤더 */}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[26px] leading-none">{activeRec.emoji}</span>
                      <div>
                        <p
                          className="text-[17px] font-black leading-tight"
                          style={{ color: activeRec.accent }}
                        >
                          {activeRec.title}
                        </p>
                        <div className="mt-1 flex items-center gap-1">
                          <Clock size={12} className="text-white/35" />
                          <span className="text-[12px] font-semibold text-white/40">
                            {recCountdown}초 후 사라짐
                          </span>
                          <span className="ml-2 text-[12px] font-bold text-white/30">
                            {activeRecIdx !== null ? `${activeRecIdx + 1} / ${rankedRecs.length}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDismissRec}
                      className="shrink-0 rounded-full p-2 text-white/40 transition-colors hover:text-white/70"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* 설명 */}
                  <p className="mb-3 text-[15px] leading-relaxed text-white/85">
                    {activeRec.description}
                  </p>

                  {/* AI 추천 이유 */}
                  <div
                    className="mb-3 rounded-xl px-3.5 py-2.5"
                    style={{ background: `${activeRec.accent}12`, border: `1px solid ${activeRec.accent}28` }}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/40 mb-1">
                      ✦ 마이 조건 집계로 고른 이유 (부스트와 별개)
                    </p>
                    <p className="text-[14px] leading-relaxed" style={{ color: `${activeRec.accent}cc` }}>
                      {activeRec.why}
                    </p>
                  </div>

                  {/* 태그 + 다음 버튼 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {activeRec.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                          style={{ backgroundColor: `${activeRec.accent}18`, color: activeRec.accent }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAiRecButton}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-[14px] font-bold transition-all active:scale-95"
                      style={{
                        borderColor: `${activeRec.accent}55`,
                        backgroundColor: `${activeRec.accent}14`,
                        color: activeRec.accent,
                      }}
                    >
                      다음 <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* 지역 프리셋 — 좌하단 고정 */}
        <div className="pointer-events-auto absolute bottom-28 left-6 z-[415] flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => setRegionPresetPanelOpen((o) => !o)}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-[12.5px] font-bold shadow-lg backdrop-blur-md transition-all active:scale-[0.97] ${
              regionPresetPanelOpen
                ? 'border-[#FFDE00]/55 bg-[#FFDE00]/16 text-[#FFDE00]'
                : 'border-white/15 bg-[#1A1A24]/95 text-white/88'
            }`}
            aria-expanded={regionPresetPanelOpen}
            aria-controls="map-region-preset-list"
          >
            <MapPinned size={17} strokeWidth={2.2} />
            지역
            <ChevronDown
              size={16}
              strokeWidth={2.2}
              className={`opacity-80 transition-transform ${regionPresetPanelOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <AnimatePresence>
            {regionPresetPanelOpen && (
              <motion.div
                id="map-region-preset-list"
                role="region"
                aria-label="지역 빠른 이동"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
                className="flex max-h-[min(46vh,420px)] w-[min(92vw,220px)] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-white/12 bg-[#12121A]/95 p-2 shadow-2xl backdrop-blur-xl"
              >
                {EXPLORE_REGION_PRESETS.map((p) => {
                  const active = nearestRegionId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setExploreCenter(p.center);
                        onExploreAnchorCommit(p.center);
                        setRegionPickVersion((v) => v + 1);
                        setRegionPresetPanelOpen(false);
                        setPendingRouteCenter(p.center);
                        onExplorePicked?.();
                      }}
                      className="flex w-full shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-left text-[11.5px] font-bold transition-all active:scale-[0.98]"
                      style={{
                        borderColor: active ? 'rgba(255,222,0,0.7)' : 'rgba(255,255,255,0.1)',
                        backgroundColor: active ? 'rgba(255,222,0,0.14)' : 'rgba(255,255,255,0.04)',
                        color: active ? '#FFDE00' : 'rgba(255,255,255,0.78)',
                        boxShadow: active ? '0 0 10px rgba(255,222,0,0.2)' : 'none',
                      }}
                    >
                      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFDE00]" />}
                      {p.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pointer-events-auto absolute bottom-28 right-4 flex max-w-[220px] flex-col items-end gap-2">
          {/* 더보기 — 우측 컬럼 최상단, 내 위치 찾기와 같은 열, 겹침 없음 */}
          {!activeRec && !quickPanelOpen && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setQuickPanelOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-[11.5px] font-bold"
              style={{
                background: 'rgba(12,12,20,0.88)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(14px)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.45)',
                color: 'rgba(255,255,255,0.55)',
              }}
              aria-label="주변 정보 더보기"
              aria-expanded={quickPanelOpen}
            >
              <span className="text-[13px] font-black leading-none">›</span>
              <span>더보기</span>
            </motion.button>
          )}
          {/* ℹ️ 실시간 위치 안내 — 실제 모드만 */}
          {!simOn && (
            <>
              {locationFactsOpen && (
                <div className="max-h-[min(52vh,320px)] w-[min(92vw,220px)] overflow-y-auto rounded-2xl border border-white/12 bg-[#12121A]/95 p-3.5 shadow-xl backdrop-blur-md">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                    실시간 위치·분포
                  </p>
                  <LocationRealtimeInfoBlock className="text-[10.5px] leading-snug text-white/55" />
                </div>
              )}
              <button
                type="button"
                aria-expanded={locationFactsOpen}
                aria-label="실시간 위치 안내 열기·닫기"
                onClick={() => setLocationFactsOpen((o) => !o)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#1A1A24]/95 text-white/55 shadow-lg backdrop-blur-md transition-colors hover:bg-white/[0.08] hover:text-white/80"
              >
                <Info size={18} strokeWidth={2.2} />
              </button>
            </>
          )}

          {/* 야외 운동시설 — 두 모드 모두 표시 */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveFacilityLayer((p) => (p === 'gym' ? null : 'gym'))}
            className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
            style={
              activeFacilityLayer === 'gym'
                ? { border: '1px solid rgba(52,211,153,0.75)', background: 'rgba(52,211,153,0.22)', boxShadow: '0 0 14px rgba(52,211,153,0.3)' }
                : { border: '1px solid rgba(52,211,153,0.40)', background: 'rgba(52,211,153,0.10)', boxShadow: '0 0 10px rgba(52,211,153,0.18)' }
            }
            aria-label="근처 야외 운동시설 표시"
          >
            <img src={OUTDOOR_GYM_MAP_ICON} alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
          </motion.button>

          {/* 화장실 — 두 모드 모두 표시 */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveFacilityLayer((p) => (p === 'toilet' ? null : 'toilet'))}
            className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
            style={
              activeFacilityLayer === 'toilet'
                ? { border: '1px solid rgba(34,197,94,0.75)', background: 'rgba(34,197,94,0.22)', boxShadow: '0 0 14px rgba(34,197,94,0.3)' }
                : { border: '1px solid rgba(34,197,94,0.40)', background: 'rgba(34,197,94,0.10)', boxShadow: '0 0 10px rgba(34,197,94,0.18)' }
            }
            aria-label="근처 무료 화장실 표시"
          >
            <img src={TOILET_MAP_ICON} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </motion.button>

          {/* 공공 쓰레기통 — 공원·가로 수거함(국가·지자체 스타일 픽토그램) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveFacilityLayer((p) => (p === 'trash' ? null : 'trash'))}
            className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
            style={
              activeFacilityLayer === 'trash'
                ? {
                    border: '1px solid rgba(148,163,184,0.75)',
                    background: 'rgba(148,163,184,0.22)',
                    boxShadow: '0 0 14px rgba(148,163,184,0.28)',
                  }
                : {
                    border: '1px solid rgba(148,163,184,0.45)',
                    background: 'rgba(148,163,184,0.10)',
                    boxShadow: '0 0 10px rgba(148,163,184,0.16)',
                  }
            }
            aria-label="근처 공공 쓰레기통·분리수거함 표시"
            title="공공 쓰레기통"
          >
            <img src={PUBLIC_TRASH_MAP_ICON} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </motion.button>

          {/* 흡연실 — 쓰레기통과 동일 패턴(500m·SVG 마커·제보 시트) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveFacilityLayer((p) => (p === 'smoking' ? null : 'smoking'))}
            className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
            style={
              activeFacilityLayer === 'smoking'
                ? {
                    border: '1px solid rgba(245,158,11,0.75)',
                    background: 'rgba(245,158,11,0.22)',
                    boxShadow: '0 0 14px rgba(245,158,11,0.28)',
                  }
                : {
                    border: '1px solid rgba(245,158,11,0.45)',
                    background: 'rgba(245,158,11,0.10)',
                    boxShadow: '0 0 10px rgba(245,158,11,0.16)',
                  }
            }
            aria-label="근처 흡연실·흡연부스 표시"
            title="흡연실"
          >
            <img src={SMOKING_ROOM_MAP_ICON} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
          </motion.button>

          {(locateUi === 'denied' || locateUi === 'unsupported') && (
            <p className="rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-left text-[11px] leading-snug text-white/75 backdrop-blur-md">
              {locateUi === 'unsupported'
                ? '이 브라우저에서는 위치를 쓸 수 없어요.'
                : '위치 권한이 필요해요. 설정에서 허용해 주세요.'}
            </p>
          )}
          {/* AI 추천 버튼 — 실제모드에서 내 위치 찾기 바로 위 */}
          <button
            type="button"
            onClick={handleAiRecButton}
            className="flex items-center gap-2 rounded-full border px-4 py-3 text-[13px] font-bold backdrop-blur-md transition-all active:scale-[0.96]"
            style={{
              borderColor: activeRec ? 'rgba(168,85,247,0.7)' : 'rgba(0,240,255,0.55)',
              backgroundColor: activeRec ? 'rgba(168,85,247,0.18)' : 'rgba(0,240,255,0.12)',
              color: activeRec ? '#c084fc' : '#00F0FF',
              boxShadow: activeRec
                ? '0 0 24px rgba(168,85,247,0.45)'
                : '0 0 18px rgba(0,240,255,0.3)',
            }}
          >
            <Sparkles size={17} strokeWidth={2.4} />
            {activeRec ? `다음 추천 →` : 'AI 추천'}
          </button>
          <button
            type="button"
            onClick={toggleMyLocation}
            disabled={locateUi === 'loading'}
            className={`flex items-center gap-2 rounded-full border border-[#00F0FF]/50 bg-[#1A1A24]/95 px-4 py-3 text-[13px] font-bold text-[#00F0FF] shadow-[0_0_24px_rgba(0,240,255,0.35)] backdrop-blur-md transition-transform active:scale-[0.97] ${
              locateUi === 'loading' ? 'disabled:opacity-100' : 'disabled:opacity-70'
            } ${
              locateUi === 'loading'
                ? 'spotvibe-locate-btn--loading-ding'
                : liveTracking
                  ? simOn
                    ? 'spotvibe-locate-btn--live-ding spotvibe-locate-btn--live-ding-sim border-violet-400/55 text-violet-300'
                    : 'spotvibe-locate-btn--live-ding'
                  : ''
            }`}
          >
            {locateUi === 'loading' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Crosshair size={18} strokeWidth={2.5} />
            )}
            {locateUi === 'loading'
              ? '내 위치 표시 중…'
              : liveTracking
                ? '실시간 추적 끄기'
                : '내 위치 찾기'}
          </button>
          {liveTracking && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                simOn
                  ? 'border-violet-500/45 bg-violet-500/15 text-violet-300'
                  : gpsStreaming
                    ? 'border-green-500/40 bg-green-500/15 text-green-400'
                    : 'border-amber-500/40 bg-amber-500/12 text-amber-200/90'
              }`}
            >
              {simOn
                ? '테스트 · 가상 위치(안양)'
                : gpsStreaming
                  ? 'LIVE · 브라우저 GPS'
                  : '마지막 위치 유지 · 신호 재탐색'}
            </span>
          )}
        </div>
      </div>
      )}

      {/* ─── 상단 버튼 행: 시각장애인 | SOS | 소화기 — 균일 간격 ─── */}
      {!mapMinimalChrome && (
        <div className="pointer-events-none absolute left-1/2 top-[4.65rem] z-[419] flex -translate-x-1/2 items-center gap-2">
          {/* 시각장애인 마커 안내 */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            animate={{ boxShadow: ['0 0 8px rgba(96,165,250,0.2)', '0 0 18px rgba(96,165,250,0.55)', '0 0 8px rgba(96,165,250,0.2)'] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            onClick={showVulnerableGuide}
            className="pointer-events-auto relative flex h-11 items-center gap-1.5 rounded-2xl px-2.5 text-[11px] font-black shadow-lg"
            style={{
              border: '1px solid rgba(96,165,250,0.52)',
              background: 'rgba(59,130,246,0.14)',
              color: '#93C5FD',
            }}
            aria-label="시각장애인 특별 마커 안내 보기"
            title="시각장애인 특별 마커 안내"
          >
            <span className="text-[13px] leading-none">🦯</span>
            <span>보호망</span>
          </motion.button>

          {/* SOS */}
          {onSosOpen && (
            <motion.button
              type="button"
              onClick={() => { if (myActiveSosSignalId) return; onSosOpen(); }}
              whileTap={{ scale: 0.92 }}
              className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg${myActiveSosSignalId ? ' spotvibe-sos-btn-active' : ''}`}
              style={myActiveSosSignalId ? {
                color: '#FF4444',
                border: '2px solid rgba(255,68,68,0.80)',
              } : {
                background: 'rgba(255,68,68,0.12)',
                border: '1px solid rgba(255,68,68,0.50)',
                boxShadow: '0 0 16px rgba(255,68,68,0.28)',
                color: '#FF4444',
              }}
              aria-label={myActiveSosSignalId ? 'SOS 신호 발신 중(전체 화면에서 종료)' : '도움 알리기 (SOS)'}
            >
              <span className="text-[11px] font-black tracking-[0.06em]">SOS</span>
            </motion.button>
          )}

          {/* 소화기 */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveFacilityLayer((p) => (p === 'fire' ? null : 'fire'))}
            className="pointer-events-auto flex h-11 items-center gap-1.5 rounded-2xl px-2.5 text-[11px] font-black shadow-lg"
            style={
              activeFacilityLayer === 'fire'
                ? { border: '1px solid rgba(239,68,68,0.75)', background: 'rgba(239,68,68,0.22)', color: '#FCA5A5', boxShadow: '0 0 14px rgba(239,68,68,0.3)' }
                : { border: '1px solid rgba(239,68,68,0.45)', background: 'rgba(239,68,68,0.12)', color: '#F87171', boxShadow: '0 0 12px rgba(239,68,68,0.22)' }
            }
            aria-label="반경 500m 소화기 위치 표시"
          >
            <span className="text-[13px] leading-none">🧯</span>
            <span>{activeFacilityLayer === 'fire' ? '500m' : '소화기'}</span>
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {vulnerableGuideOpen && !mapMinimalChrome && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute left-1/2 top-[7.9rem] z-[430] -translate-x-1/2 rounded-xl px-3.5 py-2 text-[11.5px] font-semibold text-sky-100"
            style={{
              background: 'rgba(8,16,33,0.9)',
              border: '1px solid rgba(147,197,253,0.34)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
            }}
          >
            시각장애인 보호를 위해 특별마커가 항상 표시됩니다.
          </motion.div>
        )}
      </AnimatePresence>

      {/* 더보기 버튼은 우측 컬럼(bottom-28 right-4) 상단에 통합 — 아래 컨테이너 참고 */}

      {/* 더보기 미니 바텀시트 */}
      <AnimatePresence>
        {quickPanelOpen && (
          <>
            <motion.div
              key="qp-bg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[550]"
              onClick={() => setQuickPanelOpen(false)}
            />
            <motion.div
              key="qp-sheet"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-[551] rounded-t-2xl px-5 pt-4"
              style={{
                background: 'rgba(13,13,22,0.97)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.55)',
                paddingBottom: 'calc(5.5rem + 0.5rem)', /* 내비게이션 바 88px + 여유 */
              }}
            >
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setQuickPanelOpen(false)}
                  className="pointer-events-auto h-3 w-14 rounded-full"
                  aria-label="주변 정보 패널 닫기"
                >
                  <span className="block h-1 w-full rounded-full bg-white/20" />
                </button>
              </div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/30">위치 제보</p>
              <div className="flex flex-col gap-2">
                {[
                  { emoji: '🧯',  label: '소화기 제보',      sub: '소화기 위치를 사진으로 제보',       onPress: () => setFireExtOpen(true) },
                  { emoji: '__toilet__', label: '화장실 제보', sub: '무료 화장실 위치를 사진으로 제보', onPress: () => setToiletOpen(true) },
                  {
                    emoji: '__trash__',
                    label: '공공 쓰레기통 제보',
                    sub: '공원·가로 분리수거함·수거함 위치를 사진으로 제보',
                    onPress: () => setTrashOpen(true),
                  },
                  {
                    emoji: '__smoking__',
                    label: '흡연실 제보',
                    sub: '흡연부스·지정 흡연구역 위치를 사진으로 제보',
                    onPress: () => setSmokingOpen(true),
                  },
                  { emoji: '__gym__', label: '야외 운동시설 제보', sub: '무료 야외 헬스장·운동기구 제보', onPress: () => { setCategoryFilter('gym'); setCategoryOpen(true); } },
                ].map((btn) => (
                  <motion.button
                    key={btn.label}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { btn.onPress(); setQuickPanelOpen(false); }}
                    className="mx-4 flex items-center gap-3 rounded-xl px-4 py-3 text-left"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {btn.emoji === '__gym__' ? (
                      <img src={OUTDOOR_GYM_MAP_ICON} alt="" width={26} height={26} className="h-[26px] w-[26px] shrink-0 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
                    ) : btn.emoji === '__toilet__' ? (
                      <img src={TOILET_MAP_ICON} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 object-contain" />
                    ) : btn.emoji === '__trash__' ? (
                      <img src={PUBLIC_TRASH_MAP_ICON} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 object-contain" />
                    ) : btn.emoji === '__smoking__' ? (
                      <img src={SMOKING_ROOM_MAP_ICON} alt="" width={26} height={26} className="h-[26px] w-[26px] shrink-0 object-contain" />
                    ) : (
                      <span className="text-[20px] leading-none">{btn.emoji}</span>
                    )}
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-white">{btn.label}</p>
                      <p className="text-[11px] text-white/35 mt-0.5">{btn.sub}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 실시간 사진 — 지역 검색 박스 위(카메라 FAB와 같은 줄) */}
      {!mapMinimalChrome && livePhotoFeedEnabled && (
        <motion.button
          type="button"
          onClick={() => setLivePhotosOpen(true)}
          whileTap={{ scale: 0.92 }}
          className="pointer-events-auto absolute left-4 top-[4.65rem] z-[419] flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg"
          style={{
            background: 'rgba(168,85,247,0.12)',
            border: '1px solid rgba(168,85,247,0.45)',
            boxShadow: '0 0 18px rgba(168,85,247,0.28)',
          }}
          aria-label="실시간 현장 사진 — 주변 검증된 현장 사진"
        >
          <Images size={20} color="#C084FC" strokeWidth={2.2} />
        </motion.button>
      )}
      <NearbyLivePhotosModal
        open={livePhotosOpen}
        onClose={() => setLivePhotosOpen(false)}
        mapCenter={livePhotoMapCenter}
        radiusKm={NEARBY_LIVE_PHOTOS_RADIUS_KM}
        enabled={livePhotoFeedEnabled && isActive}
        isAdmin={isAdmin}
        onModeration={onReportSubmitted}
      />
      {!mapMinimalChrome && (
        <SpotReportUpload
          fabVariant="mapToolbar"
          onReportSubmitted={onReportSubmitted}
          virtualReportLatLng={simOn ? ADMIN_MAP_TEST_VIRTUAL_LAT_LNG : null}
          isAdmin={isAdmin}
          adminReportFallbackLatLng={{ lat: exploreCenter[0], lng: exploreCenter[1] }}
        />
      )}

      {/* ─── 신규 시트 ─── */}
      <MarkerPhotoSheet
        item={selectedMarker}
        onClose={() => setSelectedMarker(null)}
        onReport={(id) => {
          setFacilityMarkers((prev) => prev.map((m) => m.id === id ? { ...m, reportCount: m.reportCount + 1 } : m));
          setSelectedMarker((prev) => prev?.id === id ? { ...prev, reportCount: prev.reportCount + 1 } : prev);
        }}
        onDelete={(id) => setFacilityMarkers((prev) => prev.filter((m) => m.id !== id))}
      />
      <ToiletSheet
        open={toiletOpen}
        onClose={() => setToiletOpen(false)}
        myLocation={myLocation ? { lat: myLocation[0], lng: myLocation[1] } : null}
        layerActive={activeFacilityLayer === 'toilet'}
      />
      <FireExtinguisherSheet
        open={fireExtOpen}
        onClose={() => setFireExtOpen(false)}
        myLocation={myLocation ? { lat: myLocation[0], lng: myLocation[1] } : null}
        onSosOpen={onSosOpen}
        layerActive={activeFacilityLayer === 'fire'}
      />
      <TrashBinSheet
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        myLocation={myLocation ? { lat: myLocation[0], lng: myLocation[1] } : null}
        layerActive={activeFacilityLayer === 'trash'}
      />
      <SmokingRoomSheet
        open={smokingOpen}
        onClose={() => setSmokingOpen(false)}
        myLocation={myLocation ? { lat: myLocation[0], lng: myLocation[1] } : null}
        layerActive={activeFacilityLayer === 'smoking'}
      />
      <ViNeighborSendSheet
        open={viNeighborSendOpen}
        onClose={() => setViNeighborSendOpen(false)}
        anchorLatLng={viNeighborAnchor}
        myUserId={userId}
        serverEnabled={mapServerEnabled}
        onOpenGuide={() => setDisabledHelpOpen(true)}
      />
      <DisabledHelperSheet
        open={disabledHelpOpen}
        onClose={() => setDisabledHelpOpen(false)}
      />
      <FacilityCategorySheet
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        myLocation={myLocation ? { lat: myLocation[0], lng: myLocation[1] } : null}
        defaultCategory={categoryFilter}
      />
    </div>
  );
}
