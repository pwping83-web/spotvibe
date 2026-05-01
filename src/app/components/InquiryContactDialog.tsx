import React, { useEffect, useState } from 'react';
import { Mail, Copy, Check, Megaphone, Sparkles, PartyPopper, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  SPOTVIBE_INQUIRY_EMAIL,
  type InquiryKind,
  INQUIRY_KIND_META,
  buildInquiryMailto,
  buildInquiryPlainText,
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setCopied(false);
    }
  }, [open, initialKind]);

  const meta = INQUIRY_KIND_META[kind];
  const plain = buildInquiryPlainText({ kind, title, body, replyEmail });
  const mailto = buildInquiryMailto({ kind, title, body, replyEmail });
  const canSend = body.trim().length >= 8;
  const mailtoTooLong = mailto.length > 1900;

  const handleOpenMail = () => {
    if (!canSend) return;
    appendLocalInquiryLog({
      at: Date.now(),
      kind,
      title: title.trim() || meta.label,
      excerpt: body.trim().slice(0, 120),
    });
    window.location.href = mailto;
  };

  const handleCopy = async () => {
    if (!canSend) return;
    try {
      await navigator.clipboard.writeText(plain);
      appendLocalInquiryLog({
        at: Date.now(),
        kind,
        title: title.trim() || meta.label,
        excerpt: body.trim().slice(0, 120),
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
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
            <DialogDescription className="text-[12px] leading-relaxed text-white/45">
              개선 의견·광고·행사 문의를 남기면 검토 후 서비스에 반영하거나 메일로 답변드릴 수 있어요. 아래 내용이 메일 앱으로 전달됩니다.
            </DialogDescription>
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
            <p className="mt-1 text-[10px] text-white/28">최소 8자 이상 입력해 주세요.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-white/50" htmlFor="inq-reply">
              회신 받을 메일 <span className="font-normal text-white/30">(선택)</span>
            </label>
            <input
              id="inq-reply"
              type="email"
              value={replyEmail}
              onChange={(e) => setReplyEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#00F0FF]/40"
            />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/28">수신 주소</p>
            <p className="mt-0.5 font-mono text-[12px] text-[#FFDE00]/90">{SPOTVIBE_INQUIRY_EMAIL}</p>
          </div>

          {mailtoTooLong && (
            <p className="text-[11px] leading-snug text-[#FFDE00]/85">
              내용이 길어 일부 메일 앱에서 열리지 않을 수 있어요.「전문 복사」로 붙여넣어 보내 주세요.
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              disabled={!canSend || mailtoTooLong}
              onClick={handleOpenMail}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/35 bg-[#00F0FF]/12 py-3 text-[13px] font-bold text-[#00F0FF] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Mail size={18} strokeWidth={2.2} />
              메일 앱으로 보내기
            </button>
            <button
              type="button"
              disabled={!canSend}
              onClick={handleCopy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] py-3 text-[13px] font-semibold text-white/85 transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? <Check size={18} className="text-[#4ADE80]" /> : <Copy size={18} />}
              {copied ? '복사됨' : '제목·본문 한 번에 복사'}
            </button>
          </div>

          <p className="pb-1 text-center text-[10px] leading-relaxed text-white/25">
            접수된 개선 제안은 내부 백로그에 쌓이고, 우선순위에 따라 업데이트에 반영됩니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
