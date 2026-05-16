import { ENX_CONTACT_EMAIL } from '@/app/constants/operatorContact';

/**
 * 운영·문의 수신 메일 (mailto·평문 푸터에 사용).
 */
export const SPOTVIBE_INQUIRY_EMAIL = ENX_CONTACT_EMAIL;

export type InquiryKind = 'improvement' | 'ad' | 'event' | 'other';

export const INQUIRY_KIND_META: Record<
  InquiryKind,
  { label: string; description: string; subjectTag: string }
> = {
  improvement: {
    label: '개선·버그 제안',
    description: '불편한 점·아이디어를 보내주시면 검토 후 반영해 나갈게요.',
    subjectTag: '개선제안',
  },
  ad: {
    label: '광고 문의',
    description: '지도·이벤트 노출 등 광고 상품 문의',
    subjectTag: '광고문의',
  },
  event: {
    label: '행사·제휴',
    description: '행사 등록, 제휴, 스폰서십',
    subjectTag: '행사문의',
  },
  other: {
    label: '기타',
    description: '그 외 운영 관련 문의',
    subjectTag: '기타',
  },
};

const STORAGE_KEY = 'spotvibe_inquiry_log_v1';

export type LocalInquiryEntry = {
  at: number;
  kind: InquiryKind;
  title: string;
  excerpt: string;
};

/** 같은 기기에서 최근 문의 이력만 남김(데모·백업 없을 때 참고용, 최대 15건) */
export function appendLocalInquiryLog(entry: LocalInquiryEntry): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev: LocalInquiryEntry[] = raw ? JSON.parse(raw) : [];
    const next = [...prev, entry].slice(-15);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function buildInquiryMailto(params: {
  kind: InquiryKind;
  title: string;
  body: string;
  replyEmail: string;
}): string {
  const meta = INQUIRY_KIND_META[params.kind];
  const subject = `[스팟바이브][${meta.subjectTag}] ${params.title.trim() || meta.label}`;
  const footer = [
    '',
    '---',
    `문의 유형: ${meta.label}`,
    params.replyEmail.trim() ? `답장을 받으실 메일: ${params.replyEmail.trim()}` : '답장을 받으실 메일: (작성 안 함)',
    `발송 시각(기기): ${new Date().toISOString()}`,
  ].join('\n');
  const fullBody = `${params.body.trim()}\n${footer}`;
  const q = (s: string) => encodeURIComponent(s);
  return `mailto:${SPOTVIBE_INQUIRY_EMAIL}?subject=${q(subject)}&body=${q(fullBody)}`;
}

export function buildInquiryPlainText(params: {
  kind: InquiryKind;
  title: string;
  body: string;
  replyEmail: string;
}): string {
  const meta = INQUIRY_KIND_META[params.kind];
  const subject = `[스팟바이브][${meta.subjectTag}] ${params.title.trim() || meta.label}`;
  const footer = [
    '',
    '---',
    `문의 유형: ${meta.label}`,
    params.replyEmail.trim() ? `답장을 받으실 메일: ${params.replyEmail.trim()}` : '답장을 받으실 메일: (작성 안 함)',
    `수신: ${SPOTVIBE_INQUIRY_EMAIL}`,
  ].join('\n');
  return `제목: ${subject}\n\n${params.body.trim()}\n${footer}`;
}
