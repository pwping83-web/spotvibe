/**
 * 마이·지도 공통 — 연령대별 남/여 테마 (지도 점·인파 안개와 동일 팔레트)
 */
export type AgeGenderPalette = {
  male: string;
  female: string;
  accent: string;
  label: string;
};

export const AGE_GENDER_COLORS: Record<string, AgeGenderPalette> = {
  '10대': { male: '#6366F1', female: '#EC4899', accent: '#A78BFA', label: '인디고·핫핑크' },
  '20대': { male: '#2563EB', female: '#DC2626', accent: '#F87171', label: '파랑·빨강' },
  '30대': { male: '#0EA5E9', female: '#EA580C', accent: '#FB923C', label: '하늘·주황' },
  '40대': { male: '#059669', female: '#CA8A04', accent: '#4ADE80', label: '에메랄드·황금' },
  '50대': { male: '#7C3AED', female: '#DB2777', accent: '#A78BFA', label: '보라·자홍' },
  '60대+': { male: '#475569', female: '#FB7185', accent: '#94A3B8', label: '회청·로즈' },
};

export const MAP_AGE_BRACKETS = ['20대', '30대', '40대'] as const;
export type MapAgeBracket = (typeof MAP_AGE_BRACKETS)[number];

export function getAgeGenderColors(ageRange: string | undefined): AgeGenderPalette {
  if (ageRange && AGE_GENDER_COLORS[ageRange]) return AGE_GENDER_COLORS[ageRange];
  return AGE_GENDER_COLORS['30대'];
}

export function mapBracketPalette(b: MapAgeBracket): AgeGenderPalette {
  return AGE_GENDER_COLORS[b] ?? AGE_GENDER_COLORS['30대'];
}

/** 지도 연령층 점 — 짝수 인덱스 여성색, 홀수 남성색 */
export function mapDotColorForBracket(bracket: MapAgeBracket, index: number): string {
  const p = mapBracketPalette(bracket);
  return index % 2 === 0 ? p.female : p.male;
}

/** 지도 인파 성별 필터와 동기 — 여성만/남성만이면 해당 색만, 전체는 남·여 교차 */
export function crowdDotColorForGenderPref(
  bracket: MapAgeBracket,
  index: number,
  genderPref: 'all' | 'female_crowd' | 'male_crowd',
): string {
  if (genderPref === 'female_crowd') return mapBracketPalette(bracket).female;
  if (genderPref === 'male_crowd') return mapBracketPalette(bracket).male;
  return mapDotColorForBracket(bracket, index);
}
