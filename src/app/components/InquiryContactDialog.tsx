import React, { useEffect, useState } from 'react';
import { Mail, Megaphone, Sparkles, PartyPopper, HelpCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { isEmailJsInquiryConfigured, sendInquiryViaEmailJs } from '@/lib/inquiryEmailjs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  type InquiryKind,
  INQUIRY_KIND_META,
  buildInquiryMailto,
  appendLocalInquiryLog,
} from '../constants/inquiry';

export type InquiryContactDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind?: InquiryKind;
};

const KIND_ORDER: InquiryKind[] = ['improvement', 'ad', 'event', 'other'];

const KIND_ICON: Record<InquiryKind, React.ReactNode> = {
  improvement: <Sparkles className="h-4 w-4" />,
  ad: <Megaphone className="h-4 w-4" />,
  event: <PartyPopper className="h-4 w-4" />,
  other: <HelpCircle className="h-4 w-4" />,
};

export function InquiryContactDialog({ open, onOpenChange, initialKind = 'improvement' }: InquiryContactDialogProps) {
  const [kind, setKind] = useState<InquiryKind>(initialKind);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const [sending, setSending] = useState(false);

  const emailJsReady = isEmailJsInquiryConfigured();

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setSending(false);
    }
  }, [open, initialKind]);

  const meta = INQUIRY_KIND_META[kind];
  const mailto = buildInquiryMailto({ kind, title, body, replyEmail });
  const bodyLen = body.trim().length;
  const minBodyLen = 8;
  const canSend = bodyLen >= minBodyLen;
  const mailtoTooLong = mailto.length > 1900;
  const sendBlockedHint = `내용을 ${minBodyLen}자 이상 입력하면 보내기를 사용할 수 있어요. (현재 ${bodyLen}자)`;

  const mailtoHref = canSend && !mailtoTooLong ? mailto : '';

  const logInquiryOpen = () => {
    appendLocalInquiryLog({
      at: Date.now(),
      kind,
      title: title.trim() || meta.label,
      excerpt: body.trim().slice(0, 120),
    });
  };

  const handleSendEmailJs = async () => {
    if (!canSend || !emailJsReady || sending) return;
    setSending(true);
    try {
      await sendInquiryViaEmailJs({ kind, title, body, replyEmail });
      appendLocalInquiryLog({
        at: Date.now(),
        kind,
        title: title.trim() || meta.label,
        excerpt: body.trim().slice(0, 120),
      });
      toast.success('문의를 보냈어요. 검토 후 연락드릴 수 있어요.');
      onOpenChange(false);
      setTitle('');
      setBody('');
      setReplyEmail('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('전송에 실패했어요. 잠시 후 다시 시도해 주세요.', {
        description: msg.length > 120 ? `${msg.slice(0, 120)}…` : msg,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#0F0F14] p-0 text-white shadow-2xl sm:max-w-[420px]">
        <div className="border-b border-white/[0.06] px-5 pb-4 pt-5 pr-11">
          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="text-[17px] font-bold tracking-tight text-white">
              운영 · 문의
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/30">문의 유형</p>
            <div className="grid grid-cols-2 gap-2">
              {KIND_ORDER.map((k) => {
                const on = kind === k;
                const m = INQUIRY_KIND_META[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.99]"
                    style={{
                      borderColor: on ? 'rgba(0,240,255,0.45)' : 'rgba(255,255,255,0.08)',
                      backgroundColor: on ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <span className="mt-0.5 shrink-0 text-[#00F0FF]">{KIND_ICON[k]}</span>
                    <span>
                      <span className="block text-[12.5px] font-semibold" style={{ color: on ? '#00F0FF' : 'rgba(255,255,255,0.82)' }}>
                        {m.label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-white/38">{meta.description}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/50" htmlFor="inq-title">
              제목 <span className="font-normal text-white/30">(선택)</span>
            </label>
            <input
              id="inq-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`예: ${meta.label} 관련`}
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#00F0FF]/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/50" htmlFor="inq-body">
              내용 <span className="text-[#FF6B6B]">*</span>
            </label>
            <textarea
              id="inq-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="불편한 점, 원하시는 기능, 행사 일정·규모, 광고 희망 기간 등 구체적으로 적어 주세요."
              className="w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-[13px] leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-[#00F0FF]/40"
            />
            <p
              className={`mt-1 text-[10px] ${bodyLen > 0 && bodyLen < minBodyLen ? 'font-medium text-[#FF6B6B]' : 'text-white/28'}`}
            >
              {bodyLen > 0 && bodyLen < minBodyLen
                ? `내용은 ${minBodyLen}자 이상 입력해 주세요. (현재 ${bodyLen}자)`
                : `최소 ${minBodyLen}자 이상 입력해 주세요.`}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/50" htmlFor="inq-reply">
              답장을 받으실 메일 주소 <span className="font-normal text-white/30">(선택)</span>
            </label>
            <input
              id="inq-reply"
              type="email"
              value={replyEmail}
              onChange={(e) => setReplyEmail(e.target.value)}
              placeholder="예: 본인 네이버·지메일 등"
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#00F0FF]/40"
            />
            {!emailJsReady && (
              <p className="mt-1 text-[10px] leading-snug text-white/28">
                비워 두면 메일 앱에 설정된 발신 주소로 이어질 수 있어요.
              </p>
            )}
          </div>

          {!emailJsReady && mailtoTooLong && (
            <p className="text-[11px] leading-snug text-[#FFDE00]/85">
              내용이 길어 메일 앱 링크가 열리지 않을 수 있어요. 본문을 나누어 짧게 적은 뒤 다시 시도해 주세요.
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {!emailJsReady && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-[10px] leading-relaxed text-amber-100/88">
                이 버튼은 <strong className="text-amber-50">기기 메일 앱</strong>만 엽니다. 사이트에서 바로내려면 Vercel Production에{' '}
                <code className="rounded bg-black/35 px-1 font-mono text-[9px] text-amber-50/95">VITE_EMAILJS_PUBLIC_KEY</code>{' '}
                <code className="rounded bg-black/35 px-1 font-mono text-[9px] text-amber-50/95">VITE_EMAILJS_SERVICE_ID</code>{' '}
                <code className="rounded bg-black/35 px-1 font-mono text-[9px] text-amber-50/95">VITE_EMAILJS_TEMPLATE_ID</code>
                를 넣고 <strong className="text-amber-50">재배포</strong>해야 합니다.
              </p>
            )}
            {!canSend && bodyLen > 0 && (
              <p className="rounded-xl border border-[#FF6B6B]/25 bg-[#FF6B6B]/08 px-3 py-2 text-center text-[11px] leading-snug text-[#FF6B6B]/95">
                {sendBlockedHint}
              </p>
            )}
            {emailJsReady && (
              <button
                type="button"
                disabled={!canSend || sending}
                title={!canSend ? sendBlockedHint : undefined}
                onClick={() => void handleSendEmailJs()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/35 bg-[#00F0FF]/12 py-3 text-[13px] font-bold text-[#00F0FF] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={18} strokeWidth={2.2} />
                {sending ? '보내는 중…' : '문의 보내기'}
              </button>
            )}
            {!emailJsReady &&
              (mailtoHref ? (
                <button
                  type="button"
                  onClick={() => {
                    logInquiryOpen();
                    window.location.href = mailtoHref;
                  }}
                  className="relative z-[1] flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/35 bg-[#00F0FF]/12 py-3 text-[13px] font-bold text-[#00F0FF] transition-all active:scale-[0.99] hover:bg-[#00F0FF]/18"
                >
                  <Mail size={18} strokeWidth={2.2} />
                  메일 앱으로 보내기
                </button>
              ) : (
                <button
                  type="button"
                  title={!canSend ? sendBlockedHint : '본문이 너무 길면 메일 링크가 열리지 않을 수 있어요. 내용을 줄여 주세요.'}
                  onClick={() => {
                    if (!canSend) {
                      toast.error(sendBlockedHint);
                      return;
                    }
                    if (mailtoTooLong) {
                      toast.error('제목·내용이 너무 길어 메일 링크로 열 수 없어요. 줄인 뒤 다시 시도해 주세요.');
                    }
                  }}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/35 bg-[#00F0FF]/12 py-3 text-[13px] font-bold text-[#00F0FF] opacity-45 transition-all active:scale-[0.99]"
                >
                  <Mail size={18} strokeWidth={2.2} />
                  메일 앱으로 보내기
                </button>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
