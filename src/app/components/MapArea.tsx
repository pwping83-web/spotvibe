import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, Loader2, MapPinned, Sparkles, X, ChevronRight, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * 내 위치: 현재는 브라우저 Geolocation + Leaflet.
 * TODO(Kakao): Kakao Maps SDK / kakao.maps.services.Geocoder 등으로 교체·정확도·백그라운드 정책 맞추기.
 */

interface MapAreaProps {
  onClusterClick: () => void;
  triggerExplorePick?: boolean;
  onExplorePickConsumed?: () => void;
  onExplorePicked?: () => void;
  mbtiSet?: Set<string>;
  genderPref?: 'all' | 'female_crowd' | 'male_crowd';
  activityTags?: Set<string>;
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
const MBTI_OVERLAY: Record<string, {
  label: string;
  color: string;
  /** exploreCenter 기준 오프셋 */
  offset: [number, number];
  radiusM: number;
}> = {
  ENFP: { label: 'ENFP 활동 구역',   color: '#FFDE00', offset: [0.003,  0.004],  radiusM: 320 },
  ENFJ: { label: 'ENFJ 활동 구역',   color: '#FFDE00', offset: [0.004, -0.003],  radiusM: 280 },
  ENTP: { label: 'ENTP 활동 구역',   color: '#00F0FF', offset: [-0.002, 0.005],  radiusM: 300 },
  ENTJ: { label: 'ENTJ 활동 구역',   color: '#00F0FF', offset: [0.005,  0.001],  radiusM: 260 },
  ESFP: { label: 'ESFP 활동 구역',   color: '#FF6B6B', offset: [0.002,  0.003],  radiusM: 310 },
  ESFJ: { label: 'ESFJ 활동 구역',   color: '#FF6B6B', offset: [-0.003, 0.003],  radiusM: 290 },
  ESTP: { label: 'ESTP 활동 구역',   color: '#FFDE00', offset: [0.001, -0.004],  radiusM: 340 },
  ESTJ: { label: 'ESTJ 활동 구역',   color: '#00F0FF', offset: [-0.004, -0.002], radiusM: 270 },
  INFP: { label: 'INFP 활동 구역',   color: '#FF6B6B', offset: [-0.005, 0.001],  radiusM: 250 },
  INFJ: { label: 'INFJ 활동 구역',   color: '#FF6B6B', offset: [-0.004, -0.004], radiusM: 230 },
  INTP: { label: 'INTP 활동 구역',   color: '#00F0FF', offset: [0.003, -0.005],  radiusM: 260 },
  INTJ: { label: 'INTJ 활동 구역',   color: '#00F0FF', offset: [-0.006, 0.002],  radiusM: 240 },
  ISFP: { label: 'ISFP 활동 구역',   color: '#FFDE00', offset: [0.002,  0.006],  radiusM: 270 },
  ISFJ: { label: 'ISFJ 활동 구역',   color: '#FFDE00', offset: [-0.002, -0.005], radiusM: 255 },
  ISTP: { label: 'ISTP 활동 구역',   color: '#FF6B6B', offset: [0.006, -0.001],  radiusM: 280 },
  ISTJ: { label: 'ISTJ 활동 구역',   color: '#FF6B6B', offset: [-0.001, -0.006], radiusM: 240 },
};

/** CartoDB Dark Matter — OSM data, no API key */
const TILE_DARK_MATTER =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const COLOR_20S = '#FFDE00';
const COLOR_30S = '#FF6B6B';
const COLOR_40S = '#00F0FF';

/** 홍대·연남 일대 — 이벤트 핀과 유저 점이 한 화면에 들어오도록 */
const INITIAL_CENTER: [number, number] = [37.5558, 126.9236];
const INITIAL_ZOOM = 14;

/** 빠른 이동 지역 프리셋 */
const REGION_PRESETS: { id: string; label: string; center: [number, number] }[] = [
  { id: 'hongdae',  label: '홍대·연남',  center: [37.5558, 126.9236] },
  { id: 'anyang',   label: '안양·평촌',  center: [37.3940, 126.9524] },
  { id: 'gangnam',  label: '강남·역삼',  center: [37.4979, 127.0276] },
  { id: 'sinchon',  label: '신촌·이대',  center: [37.5596, 126.9368] },
  { id: 'itaewon',  label: '이태원',     center: [37.5349, 126.9942] },
];

/** 40대+ 밀집 “클러스터” — 기본 지도 기준 오프셋(탐색 중심 이동 시 같이 이동) */
const CLUSTER_OFFSET_FROM_INITIAL: [number, number] = [
  37.55455 - INITIAL_CENTER[0],
  126.92405 - INITIAL_CENTER[1],
];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
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

/** 첫 고정 시에만 지도를 날아가며 맞춤 (이후 watch는 마커만 갱신) */
function MapFlyToMyLocationOnce({
  center,
  zoom,
}: {
  center: [number, number] | null;
  zoom: number;
}) {
  const map = useMap();
  const flewRef = useRef(false);

  useEffect(() => {
    if (!center || flewRef.current) return;
    map.flyTo(center, zoom, { duration: 0.85 });
    flewRef.current = true;
  }, [center, map, zoom]);

  useEffect(() => {
    if (!center) flewRef.current = false;
  }, [center]);

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
    map.flyTo(center, Math.max(13, map.getZoom()), { duration: 0.75 });
  }, [pickVersion, center, map]);
  return null;
}

/** 위치 변경 모드: 지도 클릭으로 탐색 중심 지정 */
function MapRegionPicker({
  active,
  onPick,
}: {
  active: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    el.style.cursor = active ? 'crosshair' : '';
    return () => {
      el.style.cursor = '';
    };
  }, [active, map]);

  useMapEvents({
    click(e) {
      if (!active) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

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
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;max-width:220px;">
        <div style="
          padding:5px 10px 4px;border-radius:12px 12px 0 0;
          background:linear-gradient(135deg,rgba(0,240,255,0.95),rgba(168,85,247,0.88));
          border:1px solid rgba(255,255,255,0.42);
          border-bottom:none;
          font-size:10px;font-weight:900;color:#0A0A0E;
          letter-spacing:-0.02em;
          box-shadow:0 0 16px rgba(0,240,255,0.45);
        ">${headline}</div>
        <div style="
          padding:8px 10px 9px;border-radius:0 0 12px 12px;
          background:rgba(14,14,20,0.94);
          border:1px solid ${accent}66;
          border-top:1px solid rgba(255,255,255,0.12);
          text-align:center;
          box-shadow:0 8px 22px rgba(0,0,0,0.55);
        ">
          <div style="font-size:11px;font-weight:800;color:${accent};line-height:1.35;margin-bottom:4px;">${place}</div>
          <div style="font-size:9.5px;font-weight:600;color:rgba(255,255,255,0.78);line-height:1.45;max-height:2.9em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${blurb}</div>
          <div style="margin-top:5px;font-size:8.5px;font-weight:700;color:rgba(0,240,255,0.75);">AI 추천 · 지금 이 근처</div>
        </div>
      </div>
    `,
    iconSize: [220, 120],
    iconAnchor: [110, 120],
  });
}

/** 화살표 옆 한 줄 힌트 */
function aiNudgeArrowHintIcon(deg: number, line: string): L.DivIcon {
  const safe = escapeHtml(line);
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="transform:rotate(${deg}deg);font-size:28px;line-height:1;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.65));">➤</div>
        <div style="margin-top:3px;padding:3px 8px;border-radius:999px;background:rgba(10,10,14,0.92);border:1px solid rgba(0,240,255,0.35);font-size:9px;font-weight:700;color:#00F0FF;max-width:140px;text-align:center;line-height:1.25;">${safe}</div>
      </div>
    `,
    iconSize: [148, 56],
    iconAnchor: [74, 28],
  });
}

function meAtCenterIcon(isGps: boolean): L.DivIcon {
  const label = isGps ? '내 위치' : '탐색 중심';
  const border = isGps ? 'rgba(0,240,255,0.85)' : 'rgba(255,222,0,0.55)';
  const glow = isGps ? 'rgba(0,240,255,0.5)' : 'rgba(255,222,0,0.35)';
  return L.divIcon({
    className: 'spotvibe-leaflet-div-icon',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="
          width:14px;height:14px;border-radius:50%;
          background:${isGps ? '#00F0FF' : '#FFDE00'};
          border:2px solid #fff;
          box-shadow:0 0 0 4px ${glow};
        "></div>
        <div style="margin-top:4px;padding:2px 6px;border-radius:6px;background:rgba(10,10,14,0.85);border:1px solid ${border};font-size:9px;font-weight:800;color:#fff;white-space:nowrap;">${label}</div>
      </div>
    `,
    iconSize: [88, 44],
    iconAnchor: [44, 8],
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
): string {
  const bits: string[] = [];
  if (activityTags && activityTags.size > 0) {
    bits.push(`${Array.from(activityTags).slice(0, 2).join('·')}에 어울리는`);
  }
  if (genderPref === 'female_crowd') bits.push('여성 인파 많은');
  else if (genderPref === 'male_crowd') bits.push('남성 인파 많은');
  if (mbtiSet && mbtiSet.size > 0) bits.push(`${Array.from(mbtiSet)[0]} 성향`);
  if (bits.length === 0) return '지금 지도·핀 기준으로 골라봤어.';
  return `${bits.join(' · ')} 흐름이야.`;
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
  { id: 'flea',         regionId: 'hongdae', position: [37.56105, 126.92545], label: '플리마켓 타임세일', accent: COLOR_20S, emoji: '🛍️' },
  { id: 'busking',      regionId: 'hongdae', position: [37.55435, 126.91895], label: '인디 밴드 버스킹',  accent: COLOR_30S, emoji: '🎸' },

  /* ── 안양·평촌 동안구 ── */
  { id: 'anyang_park',  regionId: 'anyang',  position: [37.3965, 126.9488],  label: '평촌중앙공원 야외공연', accent: COLOR_20S, emoji: '🎪' },
  { id: 'anyang_flea',  regionId: 'anyang',  position: [37.3895, 126.9535],  label: '범계역 플리마켓',      accent: COLOR_30S, emoji: '🛍️' },
  { id: 'anyang_cafe',  regionId: 'anyang',  position: [37.3928, 126.9512],  label: '평촌 카페거리 모임',   accent: COLOR_40S, emoji: '☕' },
  { id: 'anyang_popup', regionId: 'anyang',  position: [37.3945, 126.9540],  label: '롯데몰 팝업스토어',    accent: COLOR_20S, emoji: '🏪' },

  /* ── 강남·역삼 ── */
  { id: 'gangnam_popup', regionId: 'gangnam', position: [37.4990, 127.0280], label: '강남 브랜드 팝업',    accent: COLOR_20S, emoji: '🏪' },
  { id: 'gangnam_rooftop', regionId: 'gangnam', position: [37.4968, 127.0255], label: '루프탑 나이트아웃', accent: COLOR_30S, emoji: '🍹' },
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
    why: '지금 이 근처 30대 이상 비율이 높고 공연·수다 태그에서 반응이 집중되고 있어요.',
    accent: '#FF6B6B',
    tags: ['공연', '수다', '야경'],
    mbtiBoost: ['ENFP', 'ENFJ', 'ESFP', 'ENTP'],
    crowdBoost: ['all', 'female_crowd'],
  },
  {
    id: 'hongdae_flea_market',
    regionId: 'hongdae',
    position: [37.5610, 126.9255],
    emoji: '🛍️',
    title: '연남동 플리마켓',
    description: '핸드메이드 소품부터 빈티지 의류까지 한 곳에서. 지금 세일 타임이에요!',
    why: '쇼핑·소풍 태그가 활성화돼 있고, 근처 20대 군집이 집중되고 있어요.',
    accent: '#FFDE00',
    tags: ['쇼핑', '소풍', '야외'],
    mbtiBoost: ['ENFP', 'ESFP', 'ISFP', 'ENTP'],
    crowdBoost: ['all', 'female_crowd'],
  },
  {
    id: 'hongdae_cafe_row',
    regionId: 'hongdae',
    position: [37.5568, 126.9198],
    emoji: '☕',
    title: '연남동 카페 골목',
    description: '감성 소품·조용한 BGM 카페들이 200m 안에 밀집. 혼자도 둘이도 딱이에요.',
    why: '카페·수다 태그와 I 성향 MBTI 매칭 점수가 높아요.',
    accent: '#D97706',
    tags: ['카페', '수다'],
    mbtiBoost: ['INFP', 'INFJ', 'ISFP', 'ISFJ', 'ISTP', 'INTJ'],
    crowdBoost: ['all'],
  },
  {
    id: 'hongdae_rooftop',
    regionId: 'hongdae',
    position: [37.5526, 126.9212],
    emoji: '🌙',
    title: '홍대 루프탑 바',
    description: '야경이 탁 트이는 루프탑. 금요일 밤 최대 인기 구역이에요.',
    why: '야경·클럽 태그 + 30대 여성 인파 집중 시간이에요.',
    accent: '#A855F7',
    tags: ['야경', '클럽', '수다'],
    mbtiBoost: ['ENFJ', 'ESTP', 'ENTJ', 'ESFP'],
    crowdBoost: ['all', 'female_crowd', 'male_crowd'],
  },

  /* ── 안양·평촌 ── */
  {
    id: 'anyang_central_park',
    regionId: 'anyang',
    position: [37.3965, 126.9488],
    emoji: '🎪',
    title: '평촌 중앙공원 야외공연',
    description: '가족·연인이 함께하는 무료 야외 공연. 지금 행사 중이에요.',
    why: '야외·소풍 태그 활성 + 전 연령대 군집이 이 구역에 몰려 있어요.',
    accent: COLOR_20S,
    tags: ['야외', '소풍', '공연', '운동'],
    mbtiBoost: ['ENFP', 'ESFJ', 'ISFJ', 'ESFP'],
    crowdBoost: ['all'],
  },
  {
    id: 'anyang_beomgye_flea',
    regionId: 'anyang',
    position: [37.3895, 126.9535],
    emoji: '🛍️',
    title: '범계역 앞 플리마켓',
    description: '매월 첫째 주 토요일 개장. 빈티지·핸드메이드 100개 이상 부스.',
    why: '쇼핑 태그 집중 + 20·30대 여성 군집 최다 지점이에요.',
    accent: COLOR_30S,
    tags: ['쇼핑', '소풍', '수다'],
    mbtiBoost: ['ESFP', 'ENFP', 'ISFP', 'ESFJ'],
    crowdBoost: ['female_crowd', 'all'],
  },
  {
    id: 'anyang_cafe_street',
    regionId: 'anyang',
    position: [37.3928, 126.9512],
    emoji: '☕',
    title: '평촌 카페거리',
    description: '조용한 브런치 카페부터 트렌디한 스페셜티까지 한 블록에 모두 있어요.',
    why: '카페 태그 + MBTI I 계열이 자주 찾는 고요한 분위기예요.',
    accent: COLOR_40S,
    tags: ['카페', '수다'],
    mbtiBoost: ['INFP', 'INTJ', 'INFJ', 'INTP', 'ISFJ'],
    crowdBoost: ['all'],
  },
  {
    id: 'anyang_lotte_popup',
    regionId: 'anyang',
    position: [37.3945, 126.9540],
    emoji: '🏪',
    title: '롯데몰 팝업스토어',
    description: '이번 주 한정 브랜드 팝업 3개 동시 진행. 줄 서기 전에 가세요!',
    why: '쇼핑 태그 + 20·30대 전 성별 인파가 몰리는 핫존이에요.',
    accent: COLOR_20S,
    tags: ['쇼핑'],
    mbtiBoost: ['ENFJ', 'ESFJ', 'ESTP', 'ESTJ'],
    crowdBoost: ['all', 'female_crowd', 'male_crowd'],
  },

  /* ── 강남·역삼 ── */
  {
    id: 'gangnam_brand_popup',
    regionId: 'gangnam',
    position: [37.4990, 127.0280],
    emoji: '🏪',
    title: '강남 브랜드 팝업',
    description: '최신 콜라보 팝업 스토어. 인증샷 스팟이 잘 나오기로 유명해요.',
    why: '쇼핑·수다 태그 + 20대 E 성향 MBTI 몰림 포인트예요.',
    accent: COLOR_20S,
    tags: ['쇼핑', '수다'],
    mbtiBoost: ['ENFP', 'ESFP', 'ENTP', 'ESTP'],
    crowdBoost: ['all', 'female_crowd'],
  },
  {
    id: 'gangnam_night_rooftop',
    regionId: 'gangnam',
    position: [37.4968, 127.0255],
    emoji: '🍹',
    title: '강남 루프탑 나이트아웃',
    description: '강남 야경과 함께 칵테일 한 잔. 금요일 저녁 최고 인기 스팟이에요.',
    why: '야경·클럽 태그 + 30대 남녀 군집이 집중되는 시간대예요.',
    accent: COLOR_30S,
    tags: ['야경', '클럽', '수다'],
    mbtiBoost: ['ENTJ', 'ENFJ', 'ESTP', 'ESTJ'],
    crowdBoost: ['all', 'male_crowd'],
  },
];

const AI_REC_COUNTDOWN_SEC = 30;

function scoreAiRec(
  rec: AiRec,
  genderPref: 'all' | 'female_crowd' | 'male_crowd',
  activityTags?: Set<string>,
  mbtiSet?: Set<string>,
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
  // 성별 인파 선호 매칭
  if (rec.crowdBoost.includes(genderPref)) score += 1;
  return score;
}

function sortedAiRecs(
  candidates: AiRec[],
  genderPref: 'all' | 'female_crowd' | 'male_crowd',
  activityTags?: Set<string>,
  mbtiSet?: Set<string>,
): AiRec[] {
  return [...candidates]
    .map((r) => ({ rec: r, score: scoreAiRec(r, genderPref, activityTags, mbtiSet) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.rec);
}

/** 활성 추천 전용 핀 아이콘 */
function aiActivePinIcon(accent: string, emoji: string, title: string): L.DivIcon {
  const safe = escapeHtml(title);
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

export function MapArea({ onClusterClick, triggerExplorePick, onExplorePickConsumed, onExplorePicked, mbtiSet, genderPref = 'all', activityTags }: MapAreaProps) {
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM);
  const [mapReady, setMapReady] = useState(false);
  /** 지도에서 탭해 고른 탐색 중심(히트맵·클러스터·이벤트 핀 기준) */
  const [exploreCenter, setExploreCenter] = useState<[number, number]>(INITIAL_CENTER);
  const [pickRegionMode, setPickRegionMode] = useState(false);
  const [regionPickVersion, setRegionPickVersion] = useState(0);
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [liveTracking, setLiveTracking] = useState(false);
  const [locateUi, setLocateUi] = useState<
    'idle' | 'loading' | 'denied' | 'unsupported' | 'tracking'
  >('idle');
  /** 1분 단위 drift — seed offset이 바뀌면 점 좌표가 조금씩 이동 */
  const [driftTick, setDriftTick] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const stopLiveLocation = useCallback(() => {
    clearWatch();
    setLiveTracking(false);
    setMyLocation(null);
    setLocateUi('idle');
  }, [clearWatch]);

  useEffect(() => () => clearWatch(), [clearWatch]);

  /** 1분마다 driftTick 증가 → points 재생성으로 점들이 조금씩 이동 */
  useEffect(() => {
    const id = setInterval(() => setDriftTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

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

  /** 마이페이지 "다른 지역" 선택 시 자동으로 pick 모드 진입 */
  useEffect(() => {
    if (triggerExplorePick) {
      setPickRegionMode(true);
      onExplorePickConsumed?.();
    }
  }, [triggerExplorePick, onExplorePickConsumed]);

  const startLiveLocation = useCallback(() => {
    setPickRegionMode(false);
    if (!navigator.geolocation) {
      setLocateUi('unsupported');
      return;
    }
    setLocateUi('loading');
    const onSuccess = (pos: GeolocationPosition) => {
      const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setMyLocation(next);
      setLiveTracking(true);
      setLocateUi('tracking');
      clearWatch();
      watchIdRef.current = navigator.geolocation.watchPosition(
        (p) => {
          setMyLocation([p.coords.latitude, p.coords.longitude]);
        },
        () => {
          clearWatch();
          watchIdRef.current = null;
          setLiveTracking(false);
          setLocateUi('denied');
        },
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 },
      );
    };
    const onError = () => {
      setLiveTracking(false);
      setLocateUi('denied');
    };
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  }, [clearWatch]);

  const toggleMyLocation = useCallback(() => {
    if (liveTracking) {
      stopLiveLocation();
      return;
    }
    startLiveLocation();
  }, [liveTracking, startLiveLocation, stopLiveLocation]);

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
    for (const p of REGION_PRESETS) {
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
  }, [eventMarkersShifted, exploreCenter]);

  const aiCandidateCount = Math.max(1, aiCandidates.length);
  aiCountRef.current = aiCandidateCount;

  useEffect(() => {
    setAiSpotIndex(0);
  }, [nearestRegionId]);

  /** 가끔만 말풍선 표시 · 숨김 34–58초 / 노출 18–28초 (스팟 순서는 아래 타이머로 별도 갱신) */
  useEffect(() => {
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
  }, [nearestRegionId, aiCandidateCount]);

  /** 30–60초마다 다음 추천 스팟 + '여기 어때?' / '여기는?' 문구 교대 */
  useEffect(() => {
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
  }, [aiCandidateCount]);

  const personalizedTail = useMemo(
    () => buildPersonalizedTail(genderPref, activityTags, mbtiSet),
    [genderPref, activityTags, mbtiSet],
  );

  const activeAiPick = aiCandidates[aiSpotIndex % aiCandidateCount];

  /** AI 추천 스팟 + 화살표 인도 (앵커: GPS 있으면 내 위치, 없으면 탐색 중심) */
  const aiGuide = useMemo(() => {
    const anchor: [number, number] = myLocation ?? exploreCenter;
    let spot: [number, number] = [activeAiPick.position[0], activeAiPick.position[1]];
    let d = Math.hypot(spot[0] - anchor[0], spot[1] - anchor[1]);
    if (d < 0.00032) {
      spot = [anchor[0] + 0.00042, anchor[1] + 0.00026];
      d = Math.hypot(spot[0] - anchor[0], spot[1] - anchor[1]);
    }
    const bearing = bearingDegrees(anchor, spot);
    const arrowAt = interpLatLng(anchor, spot, 0.34);
    return { anchor, spot, bearing, arrowAt, dist: d, pickId: activeAiPick.id };
  }, [myLocation, exploreCenter, activeAiPick.id, activeAiPick.position[0], activeAiPick.position[1]]);

  const aiBlurb = useMemo(
    () => buildBlurbLine(activeAiPick, personalizedTail),
    [activeAiPick, personalizedTail],
  );

  const aiHeadline = aiPhraseFlip % 2 === 0 ? '✨ 여기 어때?' : '📍 여기는?';

  const aiArrowHintLine = useMemo(() => {
    const t = activeAiPick.title;
    const short = t.length > 16 ? `${t.slice(0, 14)}…` : t;
    return `이쪽 → ${short}`;
  }, [activeAiPick.title]);

  const aiDestIcon = useMemo(
    () =>
      aiNudgeDestinationIcon({
        headline: aiHeadline,
        placeTitle: `${activeAiPick.emoji} ${activeAiPick.title}`,
        blurb: aiBlurb,
        accent: activeAiPick.accent,
      }),
    [aiHeadline, activeAiPick.emoji, activeAiPick.title, activeAiPick.accent, aiBlurb],
  );

  const aiArrowHintIcon = useMemo(
    () => aiNudgeArrowHintIcon(aiGuide.bearing, aiArrowHintLine),
    [aiGuide.bearing, aiArrowHintLine],
  );

  const meGpsIcon = useMemo(() => meAtCenterIcon(true), []);
  const meExploreIcon = useMemo(() => meAtCenterIcon(false), []);

  /* ── 활성 AI 추천 (버튼 탭) ─────────────────────── */
  const [activeRecIdx, setActiveRecIdx] = useState<number | null>(null);
  const [recCountdown, setRecCountdown] = useState(AI_REC_COUNTDOWN_SEC);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rankedRecs = useMemo(
    () =>
      sortedAiRecs(
        AI_REC_POOL.filter(
          (r) => nearestRegionId ? r.regionId === nearestRegionId : r.regionId === 'hongdae'
        ),
        genderPref,
        activityTags,
        mbtiSet,
      ),
    [nearestRegionId, genderPref, activityTags, mbtiSet],
  );

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

  const activeRec = activeRecIdx !== null ? rankedRecs[activeRecIdx] ?? null : null;

  const activeRecPinIcon = useMemo(
    () =>
      activeRec
        ? aiActivePinIcon(activeRec.accent, activeRec.emoji, activeRec.title)
        : null,
    [activeRec],
  );

  const recAnchor = useMemo<[number, number]>(
    () => myLocation ?? exploreCenter,
    [myLocation, exploreCenter],
  );

  const recGuide = useMemo(() => {
    if (!activeRec) return null;
    const spot: [number, number] = [activeRec.position[0], activeRec.position[1]];
    const d = Math.hypot(spot[0] - recAnchor[0], spot[1] - recAnchor[1]);
    const bearing = bearingDegrees(recAnchor, spot);
    const arrowAt = interpLatLng(recAnchor, spot, 0.42);
    return { spot, bearing, arrowAt, dist: d };
  }, [activeRec, recAnchor]);

  const handleRegionMapPick = useCallback((lat: number, lng: number) => {
    setExploreCenter([lat, lng]);
    setRegionPickVersion((v) => v + 1);
    setPickRegionMode(false);
    onExplorePicked?.();
  }, [onExplorePicked]);

  const togglePickRegionMode = useCallback(() => {
    setPickRegionMode((m) => {
      const next = !m;
      if (next) stopLiveLocation();
      return next;
    });
  }, [stopLiveLocation]);

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
        35,
        1001 + driftTick * 17,
        0.55,
      ),
    [exploreCenter, driftTick],
  );
  const points30 = useMemo(
    () =>
      randomPointsInDisk(
        exploreCenter[0] - 0.0004,
        exploreCenter[1] - 0.0018,
        25,
        2002 + driftTick * 23,
        0.42,
      ),
    [exploreCenter, driftTick],
  );
  const points40 = useMemo(
    () => randomPointsInDisk(clusterCenter[0], clusterCenter[1], 45, 3003 + driftTick * 31, 0.22),
    [clusterCenter, driftTick],
  );

  const icons = useMemo(
    () => Object.fromEntries(
      EVENT_MARKERS.map((ev) => [ev.id, eventDivIcon(ev.label, ev.accent, ev.emoji)])
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
      className="absolute inset-0 z-0 bg-[#12121A] [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#0A0A0E] [&_.leaflet-bottom.leaflet-left]:mb-[7.25rem] [&_.leaflet-bottom.leaflet-left]:ml-2 [&_.leaflet-control-zoom]:overflow-hidden [&_.leaflet-control-zoom]:rounded-xl [&_.leaflet-control-zoom]:border [&_.leaflet-control-zoom]:border-white/12 [&_.leaflet-control-zoom]:bg-[#1A1A24]/95 [&_.leaflet-control-zoom]:shadow-lg [&_.leaflet-control-zoom-in]:text-white [&_.leaflet-control-zoom-out]:text-white [&_.leaflet-control-zoom-in]:leading-none [&_.leaflet-control-zoom-out]:leading-none [&_.leaflet-control-zoom-in:hover]:bg-white/10 [&_.leaflet-control-zoom-out:hover]:bg-white/10 [&_.leaflet-control-attribution]:max-w-[55%] [&_.leaflet-control-attribution]:truncate [&_.leaflet-control-attribution]:text-[9px] [&_.leaflet-control-attribution]:text-white/40 [&_.leaflet-control-attribution]:bg-black/40"
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
        className="h-full w-full"
        style={{ background: '#0A0A0E' }}
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_DARK_MATTER} />
        {/* 상단 SpotVibe 헤더·+/- 겹침 방지: 줌은 좌하단 + 탭바 여백 */}
        <ZoomLevelTracker onZoomChange={handleZoomChange} />
        <MapFlyToMyLocationOnce center={myLocation} zoom={16} />
        <MapFlyToExploreOnPick center={exploreCenter} pickVersion={regionPickVersion} />
        <MapRegionPicker active={pickRegionMode} onPick={handleRegionMapPick} />

        {/* MBTI 집합 오버레이 — 복수 선택 가능, empty = 상관없음 */}
        {mbtiSet && mbtiSet.size > 0 && Array.from(mbtiSet).map((type) => {
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
              radius={ov.radiusM * hb}
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

        {/* 성별 인파 — 단일 부드러운 안개(겹침·점선 제거로 지도·핀이 잘 보임) */}
        {genderPref === 'all' && (
          <Circle
            center={exploreCenter}
            radius={268 * hb}
            pathOptions={{
              color: 'rgba(255,255,255,0.22)',
              weight: 1,
              opacity: 0.4,
              fillColor: '#a8b4c8',
              fillOpacity: 0.035,
            }}
          />
        )}
        {genderPref === 'female_crowd' && (
          <Circle
            center={[exploreCenter[0] + 0.0008, exploreCenter[1] + 0.0018] as [number, number]}
            radius={280 * hb}
            pathOptions={{
              color: '#FF6B6B',
              weight: 1,
              opacity: 0.38,
              fillColor: '#FF6B6B',
              fillOpacity: 0.04,
            }}
          />
        )}
        {genderPref === 'male_crowd' && (
          <Circle
            center={[exploreCenter[0] - 0.0004, exploreCenter[1] - 0.0018] as [number, number]}
            radius={248 * hb}
            pathOptions={{
              color: '#00F0FF',
              weight: 1,
              opacity: 0.38,
              fillColor: '#00F0FF',
              fillOpacity: 0.04,
            }}
          />
        )}

        {/* 활동 태그 — 구역당 원 하나만, 옅은 채움 */}
        {activityTags && Array.from(activityTags).map((tag) => {
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
              radius={ov.radiusM * hb}
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

        {/* 40대+ 밀집 클릭 영역 (기존 BottomSheet 트리거) */}
        <Circle
          center={clusterCenter}
          radius={200 * hb}
          pathOptions={{
            color: COLOR_40S,
            weight: 1,
            opacity: 0.42,
            fillColor: COLOR_40S,
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

        {points20.map((pos, i) => (
          <CircleMarker
            key={`20-${i}`}
            center={pos}
            radius={userDotRadius}
            pathOptions={{
              color: COLOR_20S,
              fillColor: COLOR_20S,
              fillOpacity: 0.36,
              weight: 0.5,
              opacity: 0.55,
            }}
          />
        ))}
        {points30.map((pos, i) => (
          <CircleMarker
            key={`30-${i}`}
            center={pos}
            radius={userDotRadius}
            pathOptions={{
              color: COLOR_30S,
              fillColor: COLOR_30S,
              fillOpacity: 0.36,
              weight: 0.5,
              opacity: 0.55,
            }}
          />
        ))}
        {points40.map((pos, i) => (
          <CircleMarker
            key={`40-${i}`}
            center={pos}
            radius={userDotRadius}
            pathOptions={{
              color: COLOR_40S,
              fillColor: COLOR_40S,
              fillOpacity: 0.4,
              weight: 0.5,
              opacity: 0.58,
            }}
          />
        ))}

        <CircleMarker
          center={exploreCenter}
          radius={3.2 + 1.4 * (hb - 1)}
          pathOptions={{
            color: '#FFDE00',
            fillColor: '#FFDE00',
            fillOpacity: 0.16 + 0.08 * (hb - 1),
            weight: 1,
            opacity: 0.45,
            dashArray: '5 6',
          }}
        />

        {eventMarkersShifted.map((ev) => (
          <Marker
            key={ev.id}
            position={ev.position}
            icon={icons[ev.id]}
          />
        ))}

        {myLocation && (
          <>
            <CircleMarker
              center={myLocation}
              radius={14 + 7 * (hb - 1)}
              pathOptions={{
                color: '#00F0FF',
                fillColor: '#00F0FF',
                fillOpacity: 0.1 + 0.06 * (hb - 1),
                weight: 0,
              }}
            />
            <CircleMarker
              center={myLocation}
              radius={6.2 + 1.4 * (hb - 1)}
              pathOptions={{
                color: '#ffffff',
                fillColor: '#00F0FF',
                fillOpacity: 1,
                weight: 2,
                opacity: 1,
              }}
            />
          </>
        )}

        {/* AI 말풍선 인도 — 가끔만 노출, 매번 다른 스팟 + 설명 */}
        {aiNudgeVisible && aiGuide.dist > 1e-7 && (
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

        {myLocation ? (
          <Marker position={myLocation} icon={meGpsIcon} zIndexOffset={900} />
        ) : (
          <Marker position={exploreCenter} icon={meExploreIcon} zIndexOffset={900} />
        )}

        {/* 활성 AI 추천 — 화살표 선 + 강조 핀 */}
        {activeRec && recGuide && recGuide.dist > 1e-7 && (
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
              icon={aiNudgeArrowHintIcon(recGuide.bearing, `→ ${activeRec.title.slice(0, 14)}`)}
            />
            <Marker
              key={`rec-pin-${activeRec.id}`}
              position={recGuide.spot}
              icon={activeRecPinIcon!}
              zIndexOffset={820}
            />
          </>
        )}
      </MapContainer>

      {pickRegionMode && (
        <div className="pointer-events-none absolute left-4 right-4 top-24 z-[405] flex justify-center">
          <p className="rounded-full border border-[#FFDE00]/40 bg-black/70 px-4 py-2 text-center text-[12px] font-semibold text-[#FFDE00] shadow-lg backdrop-blur-md">
            지도를 탭하면 그 지역을 볼게요 · 취소는「위치 변경」다시 누르기
          </p>
        </div>
      )}

      {/* 내 위치 · 탐색 지역: UI 플로팅 (네비 바 위 z-index) */}
      <div className="pointer-events-none absolute inset-0 z-[410]">

        {/* ── AI 추천 카드 ── */}
        <AnimatePresence>
          {activeRec && (
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
                  borderColor: `${activeRec.accent}50`,
                  background: 'rgba(10,10,18,0.94)',
                  boxShadow: `0 0 0 1px ${activeRec.accent}22, 0 12px 40px rgba(0,0,0,0.65)`,
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

                <div className="px-4 pb-4 pt-3">
                  {/* 헤더 */}
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[22px] leading-none">{activeRec.emoji}</span>
                      <div>
                        <p
                          className="text-[14px] font-black leading-tight"
                          style={{ color: activeRec.accent }}
                        >
                          {activeRec.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1">
                          <Clock size={10} className="text-white/35" />
                          <span className="text-[10px] font-semibold text-white/35">
                            {recCountdown}초 후 사라짐
                          </span>
                          <span className="ml-2 text-[10px] font-bold text-white/28">
                            {activeRecIdx !== null ? `${activeRecIdx + 1} / ${rankedRecs.length}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDismissRec}
                      className="shrink-0 rounded-full p-1.5 text-white/40 transition-colors hover:text-white/70"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* 설명 */}
                  <p className="mb-2 text-[12.5px] leading-relaxed text-white/80">
                    {activeRec.description}
                  </p>

                  {/* AI 추천 이유 */}
                  <div
                    className="mb-3 rounded-xl px-3 py-2"
                    style={{ background: `${activeRec.accent}12`, border: `1px solid ${activeRec.accent}28` }}
                  >
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/35 mb-1">
                      ✦ AI가 고른 이유
                    </p>
                    <p className="text-[12px] leading-relaxed" style={{ color: `${activeRec.accent}cc` }}>
                      {activeRec.why}
                    </p>
                  </div>

                  {/* 태그 + 다음 버튼 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {activeRec.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: `${activeRec.accent}18`, color: activeRec.accent }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAiRecButton}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-bold transition-all active:scale-95"
                      style={{
                        borderColor: `${activeRec.accent}55`,
                        backgroundColor: `${activeRec.accent}14`,
                        color: activeRec.accent,
                      }}
                    >
                      다음 <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* 지역 프리셋 빠른 이동 — 좌하단 */}
        <div className="pointer-events-auto absolute bottom-28 left-4 flex flex-col items-start gap-1.5">
          {REGION_PRESETS.map((p) => {
            const active = nearestRegionId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setExploreCenter(p.center);
                  setRegionPickVersion((v) => v + 1);
                }}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold backdrop-blur-md transition-all active:scale-95"
                style={{
                  borderColor: active ? 'rgba(255,222,0,0.7)' : 'rgba(255,255,255,0.14)',
                  backgroundColor: active ? 'rgba(255,222,0,0.18)' : 'rgba(26,26,36,0.88)',
                  color: active ? '#FFDE00' : 'rgba(255,255,255,0.7)',
                  boxShadow: active ? '0 0 12px rgba(255,222,0,0.3)' : 'none',
                }}
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[#FFDE00]" />}
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="pointer-events-auto absolute bottom-28 right-4 flex max-w-[220px] flex-col items-end gap-2">
          {/* AI 추천 버튼 */}
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
            onClick={togglePickRegionMode}
            disabled={locateUi === 'loading'}
            className={`flex items-center gap-2 rounded-full border px-4 py-3 text-[13px] font-bold backdrop-blur-md transition-transform active:scale-[0.97] disabled:opacity-60 ${
              pickRegionMode
                ? 'border-[#FFDE00]/70 bg-[#FFDE00]/20 text-[#FFDE00] shadow-[0_0_22px_rgba(255,222,0,0.35)]'
                : 'border-white/15 bg-[#1A1A24]/95 text-white/90 shadow-lg'
            }`}
          >
            <MapPinned size={18} strokeWidth={2.2} />
            {pickRegionMode ? '지역 지정 중…' : '위치 변경'}
          </button>
          {(locateUi === 'denied' || locateUi === 'unsupported') && (
            <p className="rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-left text-[11px] leading-snug text-white/75 backdrop-blur-md">
              {locateUi === 'unsupported'
                ? '이 브라우저에서는 위치를 쓸 수 없어요.'
                : '위치 권한이 필요해요. 설정에서 허용해 주세요.'}
            </p>
          )}
          <button
            type="button"
            onClick={toggleMyLocation}
            disabled={locateUi === 'loading'}
            className="flex items-center gap-2 rounded-full border border-[#00F0FF]/50 bg-[#1A1A24]/95 px-4 py-3 text-[13px] font-bold text-[#00F0FF] shadow-[0_0_24px_rgba(0,240,255,0.35)] backdrop-blur-md transition-transform active:scale-[0.97] disabled:opacity-70"
          >
            {locateUi === 'loading' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Crosshair size={18} strokeWidth={2.5} />
            )}
            {liveTracking ? '실시간 추적 끄기' : '내 위치 찾기'}
          </button>
          {liveTracking && (
            <span className="rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-1 text-[10px] font-bold text-green-400">
              LIVE · 브라우저 GPS
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
