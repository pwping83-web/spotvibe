/**
 * SOS 첨부: EXIF 촬영 시각(현재와 근접) + 스크린샷 소프트웨어 태그 등으로
 * 구글 저장본·모니터 캡처 등을 가능한 한 걸러냄(클라이언트 휴리스틱).
 * canvas 압축 전 원본 File 에서만 호출할 것(EXIF 유지).
 */
import exifr from 'exifr';

export interface SosPhotoIntegrityOptions {
  isAdmin?: boolean;
  nowMs?: number;
}

/** SOS 만료(15분)에 맞춤 — 허위·오래된 사진보다는 막는 쪽(짧은 여유만) */
const MAX_CAPTURE_AGE_MS = 16 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 90 * 1000;

const SCREENSHOT_SOFTWARE_MARKERS = [
  'screenshot',
  'screen capture',
  'screencap',
  'snipping tool',
  'snippingtool',
  'snip & sketch',
  'snagit',
  'gyazo',
  'sharex',
  'lightshot',
  '화면 캡처',
  '스크린샷',
  'smart capture',
  'scroll capture',
];

function softwareLooksLikeScreenshot(software: string): boolean {
  const s = software.toLowerCase();
  return SCREENSHOT_SOFTWARE_MARKERS.some((m) => s.includes(m.toLowerCase()));
}

function toEpochMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

export async function assertSosPhotoTakenRecently(
  file: File,
  options: SosPhotoIntegrityOptions = {},
): Promise<{ ok: true; capturedAtMs: number } | { ok: false; reason: string }> {
  if (options.isAdmin) {
    return { ok: true, capturedAtMs: options.nowMs ?? Date.now() };
  }

  const now = options.nowMs ?? Date.now();

  if (!file.type.startsWith('image/')) {
    return { ok: false, reason: '이미지 파일만 첨부할 수 있어요.' };
  }

  let tags: Record<string, unknown>;
  try {
    tags =
      (await exifr.parse(file, {
        pick: ['DateTimeOriginal', 'CreateDate', 'Software'],
        translateKeys: true,
        reviveValues: true,
      })) ?? {};
  } catch {
    return {
      ok: false,
      reason: '사진 안의 촬영 정보를 읽지 못했어요. 카메라 앱으로 찍은 원본을 선택해 주세요.',
    };
  }

  const software = String(tags.Software ?? '').trim();
  if (software && softwareLooksLikeScreenshot(software)) {
    return {
      ok: false,
      reason: '스크린샷·화면 캡처로 보입니다. 모니터·브라우저 화면을 찍은 사진은 올릴 수 없어요.',
    };
  }

  /** DateTimeOriginal 우선, 없으면 CreateDate — ModifyDate는 저장 시각이라 제외 */
  const taken =
    toEpochMs(tags.DateTimeOriginal) ?? toEpochMs(tags.CreateDate);

  if (taken == null) {
    return {
      ok: false,
      reason:
        '촬영 시각(EXIF)이 없어요. 인터넷에서 저장한 이미지·편집본은 보통 거부돼요. 휴대폰·카메라로 방금 찍은 원본을 선택해 주세요.',
    };
  }

  if (taken > now + FUTURE_TOLERANCE_MS) {
    return {
      ok: false,
      reason: '사진의 촬영 시각이 기기 시각보다 너무 미래예요. 휴대폰 날짜·시간·원본 파일을 확인해 주세요.',
    };
  }

  const age = now - taken;
  if (age > MAX_CAPTURE_AGE_MS) {
    const mins = Math.max(1, Math.round(age / 60000));
    const limitMin = Math.round(MAX_CAPTURE_AGE_MS / 60000);
    return {
      ok: false,
      reason: `촬영 시각이 약 ${mins}분 전이에요. SOS 사진은 최근 ${limitMin}분 안에 찍은 것만 사용해 주세요.`,
    };
  }

  return { ok: true, capturedAtMs: taken };
}
