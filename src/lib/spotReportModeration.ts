/**
 * 현장 제보 제목·설명 모더레이션.
 * DB `20260503180000_spot_reports_block_lewd_text.sql` 의 `needles` 배열과 맞춰 주세요.
 */

/** 공백·구분점 제거 + ASCII 소문자 — 우회 입력(야 동, 야.동 등) 완화 */
export function normalizeForSpotReportModeration(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u00a0\u3000·・._\-*]+/g, '')
    .replace(/[0０]/g, 'o')
    .replace(/[1１]/g, 'l')
    .replace(/[3３]/g, 'e')
    .replace(/[4４]/g, 'a')
    .replace(/[5５]/g, 's')
    .replace(/[7７]/g, 't')
    .replace(/[@＠]/g, 'a');
}

/** 부분 일치(정규화된 문자열에 포함되면 차단) */
export const SPOT_REPORT_FORBIDDEN_SUBSTRINGS: readonly string[] = [
  '야동',
  '야사',
  '야한말',
  '야한',
  '음란',
  '음탕',
  '포르노',
  'porn',
  'porno',
  'xvideos',
  'pornhub',
  'redtube',
  'xhamster',
  'hentai',
  'onlyfans',
  'deepfake',
  '딥페이크',
  '19금',
  '섹스',
  'sex',
  'sextape',
  '섹파',
  '원나잇',
  '노출',
  'nude',
  'naked',
  'nsfw',
  '야추',
  '자지',
  '보지',
  '좆',
  '씹',
  'ㅈㅈ',
  'ㅂㅈ',
  'ㅅㅅ',
  '자위',
  '오럴',
  'oral',
  'blowjob',
  '펠라',
  '강간',
  '성희롱',
  '성폭행',
  '미성년자',
  'n번방',
  '몸캠',
  '벗어',
  '벗겨',
  '야설',
  'masturb',
  'ejacul',
  'cumshot',
  'dick',
  'cock',
  'penis',
  'vagina',
  'fuck',
  'fuk',
  'shit',
  'bitch',
  'slut',
  'whore',
  'hooker',
  'escort',
  'prostitut',
  'rape',
  'grope',
  'molest',
  'jav',
  'av배우',
  '야한사진',
  '야한동영상',
  '성인방',
  '성인용',
  '딸딸이',
  '딸친',
  '캠걸',
  '캠보이',
  '노팬',
  '노브라',
  '노팬티',
];

export function isSpotReportTextBlocked(placeName: string, description: string): boolean {
  const hay = normalizeForSpotReportModeration(`${placeName}\n${description}`);
  return SPOT_REPORT_FORBIDDEN_SUBSTRINGS.some((needle) =>
    hay.includes(normalizeForSpotReportModeration(needle)),
  );
}
