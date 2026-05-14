/**
 * SOS 도움 신호 바텀시트 — 이웃·주변 알림(공식 응급기관 대체 아님).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, ImagePlus, Trash2, X, CheckCircle, Loader2, MessageSquareText, Phone } from 'lucide-react';
import { SOS_TYPE_META, type SosSignalType } from '@/types/sos';

interface SosSignalSheetProps {
  open: boolean;
  onClose: () => void;
  myLocation: { lat: number; lng: number } | null;
  myActiveSignalId: string | null;
  /** 한국 달력일 기준 이미 1회 발신함(활성 신호 중이면 false로 넘기는 것을 권장) */
  dailyQuotaExceeded?: boolean;
  onSend: (type: SosSignalType, note: string, photo?: File | null) => Promise<void>;
}

const SOS_TYPES: SosSignalType[] = ['fire', 'public_safety', 'missing', 'medical'];

/** 유형 미선택 시 — 어떤 안내가 나올지 안내 */
const SOS_FACT_LINES_DEFAULT = [
  '아래에서 상황에 맞는 유형을 누르면, 그 유형에 맞는 예시·팁이 여기에 바뀌어 표시돼요.',
  '사진은 선택이에요. 넣을 때는 휴대폰·카메라로 최근(약 16분 이내) 찍은 원본만 가능해요(EXIF 촬영 시각 검사). 없으면 메모만으로도 보낼 수 있어요.',
  '알림은 반경 3km 이용자에게만 전달됩니다.',
  '이 기능은 공식 응급기관을 대체하지 않습니다. 위급하면 119·112를 먼저 이용하세요.',
] as const;

const SOS_FACT_LINES_BY_TYPE: Record<SosSignalType, readonly string[]> = {
  fire: [
    '화재 초기: 인근 가게·이웃이 소화기를 먼저 가져와 초기 진화를 도운 사례가 있어요. 연기·불길 방향을 피해 안전을 최우선하세요.',
    '연기 색, 불꽃·건물 층수 등이 보이면 이웃이 규모를 짐작하기 쉬워요. 사진은 선택, 최근 촬영(EXIF)·스크린샷 검사 후 AI가 화면 재촬영 등을 봐요.',
    '알림은 반경 3km 이용자에게만 전달됩니다.',
    '119·112 신고와 병행해 주세요. 이 앱 알림만으로 공식 대응을 대신하지 않습니다.',
  ],
  public_safety: [
    '소란·다툼, 위협·추행 의심, 야간 골목 불안 등 주변 질서·안전을 이웃에게 알릴 때 활용할 수 있어요.',
    '경광등·주변 건물·상황이 보이는 사진이 있으면 대피·회피 판단에 도움이 돼요. 사진은 선택, 최근 촬영(EXIF)·스크린샷 검사 후 AI가 화면 재촬영 등을 봐요.',
    '알림은 반경 3km 이용자에게만 전달됩니다.',
    '112 등 공식 신고가 필요하면 먼저 연락하세요. 이 기능은 응급기관을 대체하지 않습니다.',
  ],
  missing: [
    '등산로 이탈, 길 잃음, 산·강·해변 인근 조난 의심 등 이웃 수색·위치 공유에 도움을 줄 수 있어요.',
    '지형, 표지판, 주변 랜드마크가 보이는 사진이 있으면 위치 추정에 유리해요. 사진은 선택, 최근 촬영(EXIF)·스크린샷 검사 후 AI가 화면 재촬영 등을 봐요.',
    '알림은 반경 3km 이용자에게만 전달됩니다.',
    '실종·수색은 119·지자체·경찰 연계가 핵심이에요. 이 알림은 보조 수단입니다.',
  ],
  medical: [
    '의식 저하, 심한 출혈, 호흡 곤란, 알레르기 쇼크 의심 등 이웃이 AED·담요·응급 연락을 돕는 데 쓸 수 있어요.',
    '안전한 범위에서 증상·환자 자세·주변 상황이 보이면 도움이 될 수 있어요. 사진은 선택, 최근 촬영(EXIF)·스크린샷 검사 후 AI가 화면 재촬영 등을 봐요.',
    '알림은 반경 3km 이용자에게만 전달됩니다.',
    '119 구급대 연락을 최우선으로 하세요. 이 기능은 전문 의료를 대체하지 않습니다.',
  ],
};

type Step = 'intro' | 'select' | 'sending' | 'done';

function requestEmergencyDial(num: '119' | '112') {
  const label = num === '119' ? '119(소방·구급 등)' : '112(경찰)';
  if (
    !window.confirm(
      `${label}로 전화를 연결할까요?\n\n실수로 누른 경우 「취소」를 눌러 주세요.`,
    )
  ) {
    return;
  }
  window.location.href = `tel:${num}`;
}

export function SosSignalSheet({
  open,
  onClose,
  myLocation,
  myActiveSignalId,
  dailyQuotaExceeded = false,
  onSend,
}: SosSignalSheetProps) {
  const [step, setStep] = useState<Step>('intro');
  const [selected, setSelected] = useState<SosSignalType | null>(null);
  const [note, setNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open && !myActiveSignalId) {
      setStep('intro');
      setSelected(null);
    }
  }, [open, myActiveSignalId]);

  useEffect(() => {
    if (!open) {
      setPhotoFile(null);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open]);

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onPhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (!f || !f.type.startsWith('image/')) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handleSend = async () => {
    if (!selected || !myLocation) return;
    setStep('sending');
    try {
      await onSend(selected, note, photoFile);
      clearPhoto();
      setNote('');
      setStep('done');
      setTimeout(() => {
        onClose();
        setStep('intro');
        setSelected(null);
      }, 900);
    } catch {
      setStep('select');
    }
  };

  const meta = selected ? SOS_TYPE_META[selected] : null;
  const factLines = selected ? SOS_FACT_LINES_BY_TYPE[selected] : SOS_FACT_LINES_DEFAULT;
  const factKey = selected ?? 'default';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="pointer-events-auto fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="pointer-events-auto fixed bottom-0 left-1/2 z-[501] flex max-h-[92dvh] w-full max-w-[430px] -translate-x-1/2 flex-col overflow-hidden rounded-t-3xl border-t border-white/[0.1] bg-[#0F0F14] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          >
            <div className="flex justify-center pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🆘</span>
                <div>
                  <p className="text-[15px] font-bold text-white">주변에 도움 알리기</p>
                  <p className="text-[10px] text-white/40">반경 3km · 1일 1회 · 유형 4가지</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/50 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            {step === 'intro' && (
              <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <p className="text-center text-[13px] font-semibold leading-snug text-white/90">
                  공식 응급서비스(119/112)를
                  <br />
                  대체하지 않습니다
                </p>
                <p className="text-center text-[11px] leading-relaxed text-white/45">
                  위급하면 아래에서 먼저 연락한 뒤, 이웃 알림을 켜 주세요. 번호는 확인 후에만 연결됩니다.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => requestEmergencyDial('119')}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-orange-500/35 bg-orange-500/15 py-3.5 text-[15px] font-bold text-orange-100/95 active:scale-[0.98]"
                  >
                    <Phone size={18} className="shrink-0 opacity-90" aria-hidden />
                    119
                  </button>
                  <button
                    type="button"
                    onClick={() => requestEmergencyDial('112')}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-sky-500/35 bg-sky-500/15 py-3.5 text-[15px] font-bold text-sky-100/95 active:scale-[0.98]"
                  >
                    <Phone size={18} className="shrink-0 opacity-90" aria-hidden />
                    112
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!myLocation}
                  onClick={() => setStep('select')}
                  className="w-full rounded-2xl border border-white/15 bg-white/[0.08] py-3.5 text-[14px] font-bold text-white/90 transition-opacity disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/25"
                >
                  확인했습니다
                </button>
                <p className="text-center text-[10px] text-white/35">
                  {myLocation
                    ? '위치를 받았어요. 다음에서 유형을 고르세요.'
                    : '「확인했습니다」는 내 위치를 받은 뒤에만 누를 수 있어요. 119·112는 확인 후 연결됩니다.'}
                </p>
              </div>
            )}

            {step === 'select' && (
              <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-3">
                <p className="text-center text-[10px] text-white/30">
                  허위 신호는 제재 대상입니다.
                </p>

                <Link
                  to="/sos-reviews"
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-[#00F0FF]/80 hover:text-[#00F0FF]"
                >
                  <MessageSquareText size={14} />
                  지역 SOS 후기
                </Link>

                {!myLocation ? (
                  <p
                    className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-center text-[11px] font-medium text-amber-100/90"
                  >
                    지도에서 「내 위치 찾기」를 켠 뒤 발신할 수 있어요.
                  </p>
                ) : null}

                {dailyQuotaExceeded ? (
                  <p
                    className="rounded-lg border border-amber-500/35 bg-amber-500/[0.09] px-3 py-2.5 text-center text-[11px] font-medium leading-relaxed text-amber-50/95"
                  >
                    오늘은 이미 SOS를 보냈어요. 한국 시간 기준 내일 자정 이후에 다시 보낼 수 있어요.
                    <br />
                    <span className="text-white/55">무분별한 신호는 가려져요. 꼭 필요할 때만 소중하게 써 주세요.</span>
                  </p>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  {SOS_TYPES.map((type) => {
                    const m = SOS_TYPE_META[type];
                    const isSelected = selected === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={dailyQuotaExceeded}
                        onClick={() => setSelected(type)}
                        className={`flex flex-col items-start gap-0.5 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${dailyQuotaExceeded ? 'cursor-not-allowed opacity-45' : ''}`}
                        style={{
                          background: isSelected ? m.bg : 'rgba(255,255,255,0.03)',
                          borderColor: isSelected ? m.border : 'rgba(255,255,255,0.08)',
                          boxShadow: isSelected ? `0 0 14px ${m.bg}` : 'none',
                        }}
                      >
                        <span className="text-[20px] leading-none">{m.icon}</span>
                        <p className="text-[13px] font-bold text-white">{m.label}</p>
                        <p
                          className="text-[10px] leading-tight"
                          style={{ color: isSelected ? m.color : 'rgba(255,255,255,0.38)' }}
                        >
                          {m.sublabel}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {selected ? (
                  <p
                    className="text-[11px] font-semibold leading-snug"
                    style={{ color: meta!.color }}
                  >
                    {meta!.icon} {meta!.label} 유형 — 참고·예시
                  </p>
                ) : (
                  <p className="text-center text-[11px] font-medium text-white/42">
                    유형을 누르면 그 상황에 맞는 예시와 안내가 여기에 표시돼요.
                  </p>
                )}

                <ul
                  className="space-y-2 rounded-xl border bg-white/[0.03] px-3.5 py-3 transition-[border-color] duration-200"
                  style={{
                    borderColor: meta ? meta.border : 'rgba(255,255,255,0.08)',
                    boxShadow: meta ? `0 0 0 1px ${meta.border}33 inset` : undefined,
                  }}
                >
                  {factLines.map((line, i) => (
                    <li
                      key={`${factKey}-${i}`}
                      className="flex gap-2 text-[11.5px] leading-snug text-white/58"
                    >
                      <span
                        className="shrink-0"
                        style={{ color: meta ? `${meta.color}99` : 'rgba(255,255,255,0.30)' }}
                      >
                        ·
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {selected && myLocation && !dailyQuotaExceeded ? (
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={onPhotoPick}
                    />
                    <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-white/55">
                          현장 사진{' '}
                          <span className="font-normal text-white/35">(선택 · 촬영시각·AI 검증)</span>
                        </p>
                        {!photoPreview ? (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-white/80 active:scale-[0.98]"
                          >
                            <ImagePlus size={14} />
                            사진 추가
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={clearPhoto}
                            className="flex shrink-0 items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-200/90"
                          >
                            <Trash2 size={14} />
                            제거
                          </button>
                        )}
                      </div>
                      {photoPreview ? (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="relative overflow-hidden rounded-lg border border-white/10"
                        >
                          <img
                            src={photoPreview}
                            alt="첨부 미리보기"
                            className="max-h-40 w-full object-cover"
                          />
                          <span className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-white/85">
                            <Camera size={10} />
                            바꾸기
                          </span>
                        </button>
                      ) : (
                        <p className="text-[10px] leading-relaxed text-white/38">
                          갤러리에서 고른 사진도 되지만, 촬영 시각이 지금과 너무 다르거나 EXIF가 없으면 막혀요. 스크린샷·모니터 촬영·웹에서 저장한 그림은 안 돼요. AI가 화면 재촬영도 추가로 걸러요.
                        </p>
                      )}
                    </div>
                    <textarea
                      placeholder="상황 메모 (선택)"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={120}
                      rows={2}
                      className="w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[12.5px] text-white placeholder-white/25 outline-none focus:border-white/20"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      className="w-full rounded-2xl py-3.5 text-[15px] font-bold text-white transition-opacity"
                      style={{
                        background: `linear-gradient(135deg, ${meta!.color}cc 0%, ${meta!.color} 100%)`,
                      }}
                    >
                      {meta!.icon} 주변에 알리기
                    </button>
                  </div>
                ) : null}

                {selected && myLocation && dailyQuotaExceeded ? (
                  <p className="text-center text-[11px] text-white/45">오늘 발신 한도에 도달했어요. 내일 다시 시도해 주세요.</p>
                ) : null}

                {selected && !myLocation ? (
                  <p className="text-center text-[11px] text-white/40">위치를 켠 뒤 발송할 수 있어요.</p>
                ) : null}
              </div>
            )}

            {step === 'sending' && (
              <div className="flex flex-col items-center justify-center gap-3 px-5 py-8">
                <Loader2 size={36} className="animate-spin text-[#FF4444]" />
                <p className="text-[14px] font-semibold text-white/70">
                  {photoFile ? '사진 확인 후 신호 전송 중…' : '신호 발신 중…'}
                </p>
                {photoFile ? (
                  <p className="text-center text-[11px] text-white/40">
                    촬영 시각 확인 후 AI가 화면 재촬영·남용을 확인해요
                  </p>
                ) : null}
              </div>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-center gap-3 px-5 py-8">
                <CheckCircle size={40} className="text-green-400" />
                <p className="text-[15px] font-bold text-white">전달되었습니다</p>
                <p className="text-center text-[12px] leading-relaxed text-white/50">
                  잠시 후 전체 화면에서 신호 상태를 확인할 수 있어요.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
