export type ExploreRegionPreset = {
  id: string;
  label: string;
  center: [number, number];
};

/** 마이페이지「다른 지역」— 광역 → 세부 순으로 좁혀 선택 */
export type ExploreMetroGroup = {
  id: string;
  label: string;
  /** 그룹에 속하는 프리셋 id(표시 순은 가나다 — `presetsForMetro`) */
  presetIds: string[];
};

const EXPLORE_METRO_GROUPS_DATA: ExploreMetroGroup[] = [
  {
    id: 'seoul',
    label: '서울',
    presetIds: ['hongdae', 'gangnam', 'sinchon', 'itaewon', 'apgujeong_cheongdam'],
  },
  {
    id: 'seoul_outdoor',
    label: '서울 한강·산',
    presetIds: ['yeouido_hangang', 'gwanaksan', 'bukhansan_ui', 'hangang_nanji'],
  },
  {
    id: 'coast',
    label: '바닷가·휴양',
    presetIds: [
      'gangneung_gyeongpo',
      'sokcho_beach',
      'yangyang_naksan',
      'jeju_hamdeok',
      'jeju_hyeopjae',
      'incheon_eurwang',
      'yeosu_expo',
      'tongyeong_coast',
      'taean_mallipo',
      'pohang_guryongpo',
    ],
  },
  { id: 'gyeonggi', label: '경기', presetIds: ['anyang'] },
  { id: 'busan', label: '부산', presetIds: ['gwangalli', 'haeundae'] },
  { id: 'daegu', label: '대구', presetIds: ['daegu_dongseong', 'daegu_suseong'] },
  { id: 'daejeon', label: '대전', presetIds: ['daejeon_dunsan', 'daejeon_yuseong'] },
  { id: 'gwangju', label: '광주', presetIds: ['gwangju_chungjang', 'gwangju_sangmu'] },
  { id: 'ulsan', label: '울산', presetIds: ['ulsan_sungnam', 'ulsan_taehwagang'] },
];

/** 마이「다른 지역」광역 칩 — 라벨 가나다순 */
export const EXPLORE_METRO_GROUPS: ExploreMetroGroup[] = [...EXPLORE_METRO_GROUPS_DATA].sort((a, b) =>
  a.label.localeCompare(b.label, 'ko'),
);

/** 광역 id에 속한 프리셋만 반환 */
export function presetsForMetro(
  metroId: string,
  all: ExploreRegionPreset[],
): ExploreRegionPreset[] {
  const g = EXPLORE_METRO_GROUPS.find((m) => m.id === metroId);
  if (!g) return [];
  const byId = new Map(all.map((p) => [p.id, p]));
  const list = g.presetIds.map((id) => byId.get(id)).filter((p): p is ExploreRegionPreset => Boolean(p));
  return [...list].sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

/** 마이·지도 공통 — 다른 지역 탐색 프리셋(원본 정의; 아래 export 시 라벨 가나다순 정렬) */
const EXPLORE_REGION_PRESETS_DATA: ExploreRegionPreset[] = [
  { id: 'hongdae', label: '홍대·연남', center: [37.5558, 126.9236] },
  { id: 'anyang', label: '안양·평촌', center: [37.394, 126.9524] },
  { id: 'gangnam', label: '강남·역삼', center: [37.4979, 127.0276] },
  { id: 'sinchon', label: '신촌·이대', center: [37.5596, 126.9368] },
  { id: 'itaewon', label: '이태원', center: [37.5349, 126.9942] },
  { id: 'apgujeong_cheongdam', label: '압구정·청담', center: [37.5268, 127.0412] },
  { id: 'yeouido_hangang', label: '여의도 한강·고수부지', center: [37.5289, 126.9355] },
  { id: 'gwanaksan', label: '관악산·등산로', center: [37.4488, 126.9638] },
  { id: 'bukhansan_ui', label: '북한산·우이동', center: [37.6622, 127.0125] },
  { id: 'hangang_nanji', label: '망원·한강 난지', center: [37.5662, 126.8858] },
  { id: 'gwangalli', label: '부산 광안리', center: [35.1532, 129.1188] },
  { id: 'haeundae', label: '부산 해운대', center: [35.1587, 129.1604] },
  /* 바닷가·휴양(여름 피크) */
  { id: 'gangneung_gyeongpo', label: '강릉 경포·안목', center: [37.8059, 128.9079] },
  { id: 'sokcho_beach', label: '속초 해수욕장', center: [38.1901, 128.6019] },
  { id: 'yangyang_naksan', label: '양양 낙산·서피', center: [38.1324, 128.6287] },
  { id: 'jeju_hamdeok', label: '제주 함덕', center: [33.5432, 126.6693] },
  { id: 'jeju_hyeopjae', label: '제주 협재', center: [33.3944, 126.2395] },
  { id: 'incheon_eurwang', label: '인천 을왕리', center: [37.4489, 126.3669] },
  { id: 'yeosu_expo', label: '여수 밤바다·엑스포', center: [34.7576, 127.6646] },
  { id: 'tongyeong_coast', label: '통영 미륵도·해안', center: [34.8272, 128.4201] },
  { id: 'taean_mallipo', label: '태안 만리포', center: [36.7835, 126.1402] },
  { id: 'pohang_guryongpo', label: '포항 구룡포', center: [36.1174, 129.4686] },
  /* 대구 */
  { id: 'daegu_dongseong', label: '동성로·중앙로', center: [35.872, 128.5975] },
  { id: 'daegu_suseong', label: '수성못·범어', center: [35.8535, 128.623] },
  /* 대전 */
  { id: 'daejeon_dunsan', label: '둔산·탄방', center: [36.3512, 127.3846] },
  { id: 'daejeon_yuseong', label: '유성·온천', center: [36.3579, 127.341] },
  /* 광주 */
  { id: 'gwangju_chungjang', label: '충장로·금남로', center: [35.1548, 126.9155] },
  { id: 'gwangju_sangmu', label: '상무·치평', center: [35.152, 126.8518] },
  /* 울산 */
  { id: 'ulsan_sungnam', label: '성남·삼산', center: [35.5379, 129.3164] },
  { id: 'ulsan_taehwagang', label: '태화강·중앙시장', center: [35.5481, 129.2599] },
];

/** 지도「지역」패널·검색 등 — 표시는 한글 라벨 가나다순 */
export const EXPLORE_REGION_PRESETS: ExploreRegionPreset[] = [...EXPLORE_REGION_PRESETS_DATA].sort((a, b) =>
  a.label.localeCompare(b.label, 'ko'),
);

/** 최초 탐색 중심(정렬과 무관하게 홍대·연남 고정) */
export const DEFAULT_EXPLORE_CENTER: [number, number] =
  EXPLORE_REGION_PRESETS_DATA.find((p) => p.id === 'hongdae')!.center;

/** 공백·중점 제거 후 소문자(라틴) 비교용 */
function compactLabel(s: string): string {
  return s.replace(/[\s·‧,.]/g, '').toLowerCase();
}

/**
 * 지도 상단 지역 검색 — 프리셋 라벨·id 부분 일치.
 * 예: "광안리" → 부산 광안리, "홍대" → 홍대·연남
 */
export function matchExploreRegionPresets(
  query: string,
  presets: ExploreRegionPreset[] = EXPLORE_REGION_PRESETS,
  limit = 10,
): ExploreRegionPreset[] {
  const raw = query.trim();
  if (!raw) return [];

  const lower = raw.toLowerCase();
  const qComp = compactLabel(raw);

  const rank = (p: ExploreRegionPreset): number => {
    const lab = p.label;
    const labL = lab.toLowerCase();
    const idUnderscore = p.id.toLowerCase();

    if (lab.includes(raw)) return 100;
    if (labL.includes(lower)) return 95;
    if (compactLabel(lab).includes(qComp)) return 90;
    if (idUnderscore.includes(lower.replace(/\s/g, '_'))) return 85;
    if (idUnderscore.replace(/_/g, '').includes(qComp.replace(/_/g, ''))) return 82;

    const parts = lab.split(/[·\s,]+/).map((t) => t.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes(raw) || part.toLowerCase().includes(lower)) return 70;
      if (compactLabel(part).includes(qComp)) return 68;
    }
    return 0;
  };

  return [...presets]
    .map((p) => ({ p, r: rank(p) }))
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r || a.p.label.localeCompare(b.p.label, 'ko'))
    .map((x) => x.p)
    .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i)
    .slice(0, limit);
}

/** 지도에서 찍은 좌표 → 네이버 검색어·표시용 라벨 (가까운 프리셋이 있으면 지명) */
export function explorePickRouteInfo(center: [number, number]): { naverQuery: string; displayLabel: string } {
  let best: ExploreRegionPreset | null = null;
  let bestD = Infinity;
  for (const p of EXPLORE_REGION_PRESETS) {
    const d = Math.hypot(p.center[0] - center[0], p.center[1] - center[1]);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  // 약 6km 이내면 프리셋 라벨로 검색 (한글 지명)
  if (best && bestD < 0.055) {
    return { naverQuery: best.label, displayLabel: best.label };
  }
  const q = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
  return { naverQuery: q, displayLabel: '선택한 위치' };
}

/** 탐색 중심에 가장 가까운 프리셋 id — `maxDistDegrees` 밖이면 null */
export function nearestExplorePresetId(
  center: [number, number],
  presets: ExploreRegionPreset[] = EXPLORE_REGION_PRESETS,
  maxDistDegrees = 0.05,
): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const p of presets) {
    const d = Math.hypot(center[0] - p.center[0], center[1] - p.center[1]);
    if (d < bestD) {
      bestD = d;
      best = p.id;
    }
  }
  return bestD < maxDistDegrees ? best : null;
}

/**
 * AI 인사이트·테스트 모드 지도 추천 — 허용할 `regionId`(=프리셋 id) 집합.
 * 서울·한강·산은 하나의 서울권으로 묶고, 부산·경기 등은 해당 광역의 프리셋만.
 */
export function aiInsightPresetIdsForAnchorPreset(nearestPresetId: string | null): Set<string> {
  if (!nearestPresetId) return new Set(['hongdae']);
  const seoul = EXPLORE_METRO_GROUPS_DATA.find((m) => m.id === 'seoul');
  const seoulOut = EXPLORE_METRO_GROUPS_DATA.find((m) => m.id === 'seoul_outdoor');
  const seoulUnion = new Set([...(seoul?.presetIds ?? []), ...(seoulOut?.presetIds ?? [])]);
  if (seoulUnion.has(nearestPresetId)) return seoulUnion;
  const owner = EXPLORE_METRO_GROUPS_DATA.find((m) => m.presetIds.includes(nearestPresetId));
  if (!owner) return new Set([nearestPresetId]);
  return new Set(owner.presetIds);
}

export type AiInsightUiBucket = 'seoul' | 'busan' | 'gyeonggi' | 'coast' | 'other';

export function aiInsightUiBucketFromPreset(nearestPresetId: string | null): AiInsightUiBucket {
  if (!nearestPresetId) return 'other';
  if (nearestPresetId === 'gwangalli' || nearestPresetId === 'haeundae') return 'busan';
  if (nearestPresetId === 'anyang') return 'gyeonggi';
  const coastIds = EXPLORE_METRO_GROUPS_DATA.find((m) => m.id === 'coast')?.presetIds ?? [];
  if (coastIds.includes(nearestPresetId)) return 'coast';
  const seoulIds = aiInsightPresetIdsForAnchorPreset('hongdae');
  if (seoulIds.has(nearestPresetId)) return 'seoul';
  return 'other';
}

/** 알림 탭·설명용 짧은 권역 이름 */
export function aiInsightMetroLabel(nearestPresetId: string | null): string {
  if (!nearestPresetId) return '탐색 지역';
  const b = aiInsightUiBucketFromPreset(nearestPresetId);
  switch (b) {
    case 'seoul':
      return '서울·수도권 핵심';
    case 'busan':
      return '부산';
    case 'gyeonggi':
      return '경기';
    case 'coast':
      return '바닷가·휴양';
    default: {
      const p = nearestPresetId ? EXPLORE_REGION_PRESETS.find((x) => x.id === nearestPresetId) : null;
      return p?.label ?? '탐색 지역';
    }
  }
}
