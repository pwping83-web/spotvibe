import emailjs from '@emailjs/browser';
import {
  buildInquiryPlainText,
  INQUIRY_KIND_META,
  type InquiryKind,
} from '@/app/constants/inquiry';

/** Vite는 `VITE_` 접두사가 있는 변수만 클라이언트 번들에 넣습니다. (Vercel에 넣었어도 이름이 다르면 앱에서는 비어 있음) */
function envPick(...keys: string[]): string | undefined {
  const e = import.meta.env as Record<string, string | undefined>;
  for (const k of keys) {
    const v = e[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

const serviceId = envPick('VITE_EMAILJS_SERVICE_ID', 'VITE_EMAILJS_SERVICEID');
const templateId = envPick(
  'VITE_EMAILJS_TEMPLATE_ID',
  'VITE_EMAILJS_TEMPLATEID',
  'VITE_EMAILJS_TEMPLATE',
);
/** Public Key — 일부 문서·대시보드에서는 User ID와 동일 값으로 안내 */
const publicKey = envPick(
  'VITE_EMAILJS_PUBLIC_KEY',
  'VITE_EMAILJS_PUBLICKEY',
  'VITE_EMAILJS_USER_ID',
);

export function isEmailJsInquiryConfigured(): boolean {
  return Boolean(serviceId && templateId && publicKey);
}

/**
 * EmailJS 템플릿 필드(이름 일치 필수):
 * - {{subject}}, {{message}}, {{kind}}, {{reply_email}}
 * HTML 예시: 문서/운영-문의-템플릿/emailjs-inquiry-template.html → 대시보드 템플릿 Content에 붙여 넣기
 */
export async function sendInquiryViaEmailJs(params: {
  kind: InquiryKind;
  title: string;
  body: string;
  replyEmail: string;
}): Promise<void> {
  if (!isEmailJsInquiryConfigured()) {
    throw new Error('emailjs_not_configured');
  }
  const meta = INQUIRY_KIND_META[params.kind];
  const subject = `[스팟바이브][${meta.subjectTag}] ${params.title.trim() || meta.label}`;
  const message = buildInquiryPlainText({
    kind: params.kind,
    title: params.title,
    body: params.body,
    replyEmail: params.replyEmail,
  });

  const res = await emailjs.send(
    serviceId!,
    templateId!,
    {
      subject,
      message,
      kind: meta.label,
      reply_email: params.replyEmail.trim(),
    },
    { publicKey: publicKey! },
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(res.text || 'emailjs_send_failed');
  }
}
