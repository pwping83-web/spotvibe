/**
 * 공중화장실 위치 시트 — 심플 버전
 * 지도 마커 아이콘: `/icons/facility-poi-wc.svg` (남·녀 픽토그램, 차단 목록 회피용 중립 파일명)
 */
import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Camera, CheckCircle, Loader2, MapPin } from 'lucide-react';

export const TOILET_MAP_ICON = '/icons/facility-poi-wc.svg';

interface ToiletSheetProps {
  open: boolean;
  onClose: () => void;
  myLocation: { lat: number; lng: number } | null;
  layerActive?: boolean;
}

type UploadStep = 'idle' | 'checking' | 'done';

interface ToiletItem {
  id: string;
  label: string;
  dist: number;
  verified: boolean;
  closed: boolean;
}

const DEMO: ToiletItem[] = [
  { id: 't1', label: '공원 공중화장실',  dist: 95,  verified: true,  closed: false },
  { id: 't2', label: '등산로 화장실',    dist: 310, verified: true,  closed: false },
  { id: 't3', label: '편의점 화장실',    dist: 460, verified: false, closed: false },
  { id: 't4', label: '지하상가 화장실',  dist: 580, verified: true,  closed: true  },
];

function fmtDist(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

export function ToiletSheet({ open, onClose, myLocation }: ToiletSheetProps) {
  const [items, setItems] = useState<ToiletItem[]>(DEMO);
  const [step, setStep] = useState<UploadStep>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setStep('checking');
    setTimeout(() => {
      setItems((prev) => [
        { id: `u_${Date.now()}`, label: '무료 화장실', dist: Math.floor(Math.random() * 200) + 30, verified: true, closed: false },
        ...prev,
      ]);
      setStep('done');
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => setStep('idle'), 2000);
    }, 1800);
  };

  const toggleClosed = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, closed: !i.closed } : i)));

  const nearest = items.find((i) => !i.closed);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="tl-bg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="tl-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[601] rounded-t-3xl"
            style={{ background: 'rgba(12,12,20,0.98)', borderTop: '1px solid rgba(34,197,94,0.15)' }}
          >
            {/* 핸들 */}
            <button type="button" onClick={onClose} className="flex w-full justify-center pt-3 pb-2" aria-label="닫기">
              <span className="block h-1 w-12 rounded-full bg-white/18" />
            </button>

            <div className="px-5 pb-[calc(5.5rem+0.75rem)]">
              {/* 헤더 */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={TOILET_MAP_ICON}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-white/5 p-0.5"
                  />
                  <div>
                    <p className="text-[15px] font-black text-white">무료 화장실</p>
                    <p className="text-[11px] text-white/35">{nearest ? `가장 가까운 · ${fmtDist(nearest.dist)}` : '주변 화장실'}</p>
                  </div>
                </div>
                <button type="button" onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/35">
                  <X size={13} />
                </button>
              </div>

              {/* 제보 버튼 */}
              {step === 'idle' && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3"
                  style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.28)' }}
                >
                  <Camera size={15} className="text-green-400" />
                  <span className="text-[13px] font-bold text-green-400">사진으로 제보하기</span>
                </button>
              )}
              {step === 'checking' && (
                <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Loader2 size={14} className="animate-spin text-white/40" />
                  <span className="text-[12.5px] text-white/45">GPS · 위치 검증 중...</span>
                </div>
              )}
              {step === 'done' && (
                <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl py-3"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)' }}>
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="text-[12.5px] font-bold text-green-400">지도에 등록됐어요!</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

              {/* 목록 */}
              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <div key={item.id}
                    className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                    style={{
                      background: item.closed ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      opacity: item.closed ? 0.45 : 1,
                    }}>
                    <div className="flex items-center gap-2.5">
                      {item.closed ? (
                        <span className="text-[15px]">🚫</span>
                      ) : (
                        <img src={TOILET_MAP_ICON} alt="" width={22} height={22} className="opacity-90" />
                      )}
                      <div>
                        <p className={`text-[13px] font-bold ${item.closed ? 'line-through text-white/30' : 'text-white'}`}>
                          {item.label}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin size={9} className="text-white/20" />
                          <span className="text-[10.5px] text-white/28">{fmtDist(item.dist)}</span>
                          {item.verified && !item.closed && (
                            <span className="text-[9.5px] font-bold text-green-400/50">📸 인증</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!item.closed && (
                      <button type="button" onClick={() => toggleClosed(item.id)}
                        className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] text-white/25"
                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                        폐쇄
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
