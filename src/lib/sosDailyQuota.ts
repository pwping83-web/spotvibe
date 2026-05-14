/**
 * SOS 일일 횟수 — 한국 날짜(KST) 자정 기준.
 */

/** 오늘 00:00 KST를 나타내는 ISO 문자열 (UTC 치환 비교용) */
export function kstTodayStartIsoUtc(now = new Date()): string {
  const ymd = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  return `${ymd}T00:00:00+09:00`;
}
