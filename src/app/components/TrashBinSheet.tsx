/**
 * 공공 쓰레기통(분리수거함) 위치 시트 — 화장실·소화기와 동일 UX (사진 제보·목록)
 * 지도 마커 아이콘: `/icons/facility-public-trash.svg` (공원·가로 공공 수거함 픽토그램 스타일)
 */
import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Camera, CheckCircle, Loader2, MapPin } from 'lucide-react';

export const PUBLIC_TRASH_MAP_ICON = '/icons/facility-public-trash.svg';

interface TrashBinSheetProps {
  open: boolean;
  onClose: () => void;
  myLocation: { lat: number; lng: number } | null;
  layerActive?: boolean;
}

type UploadStep = 'idle' | 'checking' | 'done';

interface TrashItem {
  id: string;
  label: string;
  dist: number;
  verified: boolean;
  /** 철거·이동으로 없어짐 */
  gone: boolean;
}

const DEMO: TrashItem[] = [
  { id: 'z1', label: '공원 분리수거함', dist: 88, verified: true, gone: false },
  { id: 'z2', label: '등산로 입구 재활용함', dist: 265, verified: true, gone: false },
  { id: 'z3', label: '개천 산책로 일반쓰레기', dist: 420, verified: false, gone: false },
  { id: 'z4', label: '옛 위치(철거됨)', dist: 600, verified: true, gone: true },
];

function fmtDist(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

export function TrashBinSheet({ open, onClose, myLocation: _myLocation }: TrashBinSheetProps) {
  const [items, setItems] = useState<TrashItem[]>(DEMO);
  const [step, setStep] = useState<UploadStep>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setStep('checking');
    setTimeout(() => {
      setItems((prev) => [
        {
          id: `u_${Date.now()}`,
          label: '공공 쓰레기통',
          dist: Math.floor(Math.random() * 200) + 40,
          verified: true,
          gone: false,
        },
        ...prev,
      ]);
      setStep('done');
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => setStep('idle'), 2000);
    }, 1800);
  };

  const toggleGone = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, gone: !i.gone } : i)));

  const nearest = items.find((i) => !i.gone);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="tb-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="tb-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[601] rounded-t-3xl"
            style={{ background: 'rgba(12,12,20,0.98)', borderTop: '1px solid rgba(148,163,184,0.22)' }}
          >
            <button type="button" onClick={onClose} className="flex w-full justify-center pt-3 pb-2" aria-label="닫기">
              <span className="block h-1 w-12 rounded-full bg-white/18" />
            </button>

            <div className="px-5 pb-[calc(5.5rem+0.75rem)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={PUBLIC_TRASH_MAP_ICON}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-white/5 p-0.5"
                  />
                  <div>
                    <p className="text-[15px] font-black text-white">공공 쓰레기통</p>
                    <p className="text-[11px] text-white/35">
                      {nearest ? `가장 가까운 · ${fmtDist(nearest.dist)}` : '주변 수거함'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/35"
                >
                  <X size={13} />
                </button>
              </div>

              {step === 'idle' && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3"
                  style={{ background: 'rgba(148,163,184,0.10)', border: '1px solid rgba(148,163,184,0.28)' }}
                >
                  <Camera size={15} className="text-slate-300" />
                  <span className="text-[13px] font-bold text-slate-200">사진으로 제보하기</span>
                </button>
              )}
              {step === 'checking' && (
                <div
                  className="mb-4 flex items-center justify-center gap-2 rounded-2xl py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <Loader2 size={14} className="animate-spin text-white/40" />
                  <span className="text-[12.5px] text-white/45">GPS · 위치 검증 중...</span>
                </div>
              )}
              {step === 'done' && (
                <div
                  className="mb-4 flex items-center justify-center gap-2 rounded-2xl py-3"
                  style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.22)' }}
                >
                  <CheckCircle size={14} className="text-slate-300" />
                  <span className="text-[12.5px] font-bold text-slate-200">지도에 등록됐어요!</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                    style={{
                      background: item.gone ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      opacity: item.gone ? 0.45 : 1,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={PUBLIC_TRASH_MAP_ICON} alt="" width={22} height={22} className="opacity-90" />
                      <div>
                        <p
                          className={`text-[13px] font-bold ${item.gone ? 'line-through text-white/30' : 'text-white'}`}
                        >
                          {item.label}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <MapPin size={9} className="text-white/20" />
                          <span className="text-[10.5px] text-white/28">{fmtDist(item.dist)}</span>
                          {item.verified && !item.gone && (
                            <span className="text-[9.5px] font-bold text-slate-400/70">인증</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!item.gone && (
                      <button
                        type="button"
                        onClick={() => toggleGone(item.id)}
                        className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] text-white/25"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        없음
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
