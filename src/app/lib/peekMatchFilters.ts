/**
 * (레거시) 프로필 필터 조건(MBTI·혈액형·활동·성별 인파·연령)과
 * Supabase `profiles` 행이 맞는지 — `useMatchedUsers`와 동일 규칙.
 */
export type ProfilePeekMatchRow = {
  gender: string | null;
  age_range: string | null;
  activity_tags: string[] | null;
  mbti_types: string[] | null;
  blood_types: string[] | null;
};

export type PeekMatchFilterInput = {
  activityTags: Set<string>;
  mbtiSet: Set<string>;
  bloodTypeSet: Set<string>;
  genderPref: 'all' | 'female_crowd' | 'male_crowd';
  ageRangeSet: Set<string>;
};

export function profileMatchesPeekFilters(row: ProfilePeekMatchRow, f: PeekMatchFilterInput): boolean {
  const genderFilter =
    f.genderPref === 'female_crowd' ? ['여성'] : f.genderPref === 'male_crowd' ? ['남성'] : null;

  if (genderFilter && !genderFilter.includes(row.gender ?? '')) return false;

  if (f.ageRangeSet.size > 0 && !f.ageRangeSet.has(row.age_range ?? '')) return false;

  if (f.activityTags.size > 0) {
    const rowTags = row.activity_tags ?? [];
    if (rowTags.filter((t) => f.activityTags.has(t)).length === 0) return false;
  }

  if (f.mbtiSet.size > 0) {
    const rowMbti = row.mbti_types ?? [];
    if (rowMbti.filter((m) => f.mbtiSet.has(m)).length === 0) return false;
  }

  if (f.bloodTypeSet.size > 0) {
    const rowBlood = row.blood_types ?? [];
    if (rowBlood.filter((b) => f.bloodTypeSet.has(b)).length === 0) return false;
  }

  return true;
}
