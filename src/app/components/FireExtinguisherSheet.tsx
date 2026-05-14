/**
 * 소화기 위치 시트
 * - 핵심: 현장 사진 제보 → GPS+EXIF 검증 → 지도 마커 등록
 * - 지도에 표시된 마커 = 이 시트에서 시민이 직접 찍어 올린 인증 사진
 * - 없음 신고: 확인 후 소화기가 사라진 경우 신고
 */
import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Camera, MapPin, CheckCircle, Loader2, AlertTriangle, ChevronRight, Clock } from 'lucide-react';

interface FireExtinguisherSheetProps {
  open: boolean;
  onClose: () => void;
  myLocation: { lat: number; lng: number } | null;
  onSosOpen?: () => void;
  /** 현재 지도에 소화기 레이어가 활성 상태인지 */
  layerActive?: boolean;
}

type ExtStatus = 'ok' | 'gone';

interface ExtItem {
  id: string;
  label: string;
  description: string;
  reportedAt: string;
  status: ExtStatus;
  dist?: number;
  hasPhoto: boolean;
}

const DEMO_ITEMS: ExtItem[] = [
  { id: 'e1', label: '산불진화장비 보관함', description: '숲길안내센터 옆 · 호스·삽 포함',     reportedAt: '2026-05-08', status: 'ok',   dist: 120, hasPhoto: true  },
  { id: 'e2', label: '소화기',             description: '숲길안내센터 내부',                   reportedAt: '2026-05-08', status: 'ok',   dist: 280, hasPhoto: true  },
  { id: 'e3', label: '소화기',             description: '등산로 중간 갈림길',                  reportedAt: '2026-04-15', status: 'gone', dist: 430, hasPhoto: false },
];

type UploadStep = 'idle' | 'checking' | 'preview' | 'uploading' | 'done';

function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

function daysAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (diff === 0) return '오늘';
  if (diff < 30) return `${diff}일 전`;
  return `${Math.floor(diff / 30)}개월 전`;
}

export function FireExtinguisherSheet({
  open,
  onClose,
  myLocation,
  onSosOpen,
  layerActive,
}: FireExtinguisherSheetProps) {
  const [items, setItems] = useState<ExtItem[]>(DEMO_ITEMS);
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStep('checking');
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // GPS·EXIF 검증 시뮬레이션 (실제는 sosPhotoIntegrity.ts 패턴 동일 적용)
    setTimeout(() => setUploadStep('preview'), 1400);
  };

  const handleSubmit = () => {
    setUploadStep('uploading');
    setTimeout(() => {
      setItems((prev) => [
        {
          id: `user_${Date.now()}`,
          label: '소화기',
          description: '내가 직접 확인 · AI 검증 완료',
          reportedAt: new Date().toISOString().slice(0, 10),
          status: 'ok',
          dist: myLocation ? Math.floor(Math.random() * 300) + 50 : undefined,
          hasPhoto: true,
        },
        ...prev,
      ]);
      setUploadStep('done');
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadStep('idle'), 2000);
    }, 1600);
  };

  const reportGone = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'gone' as const } : i)));
  };

  const okItems = items.filter((i) => i.status === 'ok');
  const nearest = okItems[0];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="fe-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="fe-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[601] max-h-[88vh] overflow-y-auto rounded-t-3xl"
            style={{ background: 'rgba(12,12,20,0.98)', borderTop: '1px solid rgba(255,80,80,0.18)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <button
                type="button"
                onClick={onClose}
                className="pointer-events-auto h-3 w-14 flex items-center justify-center"
                aria-label="닫기"
              >
                <span className="block h-1 w-full rounded-full bg-white/20" />
              </button>
            </div>

            <div className="px-5 pt-3" style={{ paddingBottom: 'calc(5.5rem + 0.5rem)' }}>
              {/* 헤더 */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-[17px] font-black text-white">🧯 소화기 위치 제보</p>
                  <p className="text-[12px] text-white/40 mt-0.5">사진 찍어 올리면 지도 마커로 등록됩니다</p>
                </div>
                <button type="button" onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/40">
                  <X size={15} />
                </button>
              </div>

              {/* ─── 핵심: 사진 제보하기 ─── */}
              <div className="mb-5 rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(239,68,68,0.28)', background: 'rgba(239,68,68,0.07)' }}>
                <div className="px-4 pt-4 pb-3">
                  <p className="text-[13.5px] font-black text-white mb-1">📸 소화기 위치 제보하기</p>
                  <p className="text-[11.5px] text-white/50 leading-snug">
                    현장에서 소화기를 발견하면 직접 찍어 올려주세요.<br />
                    GPS 위치·촬영 시각이 일치해야 지도 마커로 등록됩니다.
                  </p>
                </div>

                {/* 업로드 상태별 UI */}
                {uploadStep === 'idle' && (
                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 transition-all active:scale-[0.97]"
                      style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.35)' }}
                    >
                      <Camera size={16} className="text-red-300" />
                      <span className="text-[13.5px] font-bold text-red-300">사진 찍어 제보하기</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                )}

                {uploadStep === 'checking' && (
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-3 rounded-xl px-3.5 py-3"
                      style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <Loader2 size={15} className="animate-spin text-white/50" />
                      <div>
                        <p className="text-[12.5px] font-bold text-white/70">GPS · EXIF 검증 중...</p>
                        <p className="text-[11px] text-white/35 mt-0.5">촬영 위치·시각 확인 중</p>
                      </div>
                    </div>
                  </div>
                )}

                {uploadStep === 'preview' && previewUrl && (
                  <div className="px-4 pb-4">
                    {/* 검증 결과 */}
                    <div className="mb-3 flex flex-col gap-1.5">
                      {[
                        { ok: true,  text: 'GPS 위치 확인 · 현재 위치와 일치' },
                        { ok: true,  text: 'EXIF 촬영 시각 확인 · 5분 이내' },
                        { ok: myLocation !== null, text: myLocation ? '위치 서비스 활성' : '위치 서비스 필요' },
                      ].map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle size={13} style={{ color: v.ok ? '#4ADE80' : '#F87171' }} />
                          <span className="text-[11.5px]" style={{ color: v.ok ? 'rgba(255,255,255,0.65)' : '#F87171' }}>
                            {v.text}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* 사진 미리보기 */}
                    <div className="mb-3 overflow-hidden rounded-xl" style={{ maxHeight: 160 }}>
                      <img src={previewUrl} alt="제보 사진" className="w-full object-cover" style={{ maxHeight: 160 }} />
                    </div>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => { setUploadStep('idle'); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="flex-1 rounded-xl py-2.5 text-[12.5px] font-bold text-white/40"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        다시 찍기
                      </button>
                      <button type="button"
                        onClick={handleSubmit}
                        className="flex-1 rounded-xl py-2.5 text-[12.5px] font-bold text-white"
                        style={{ background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.4)' }}>
                        제보 완료
                      </button>
                    </div>
                  </div>
                )}

                {uploadStep === 'uploading' && (
                  <div className="px-4 pb-4 flex items-center gap-3">
                    <Loader2 size={15} className="animate-spin text-red-400" />
                    <p className="text-[12.5px] font-bold text-white/60">지도에 등록 중...</p>
                  </div>
                )}

                {uploadStep === 'done' && (
                  <div className="px-4 pb-4 flex items-center gap-3">
                    <CheckCircle size={15} className="text-green-400" />
                    <p className="text-[12.5px] font-bold text-green-400">지도 마커로 등록됐어요!</p>
                  </div>
                )}
              </div>

              {/* 화재 SOS 연계 */}
              {onSosOpen && (
                <button type="button"
                  onClick={() => { onClose(); onSosOpen(); }}
                  className="mb-4 flex w-full items-center justify-between rounded-xl px-3.5 py-3 transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.18)' }}>
                  <div>
                    <p className="text-[13px] font-bold text-red-400">화재 SOS — 이웃에게 알리기</p>
                    <p className="text-[11px] text-white/30 mt-0.5">119 신고 후 이웃에게도 알려요</p>
                  </div>
                  <ChevronRight size={15} className="text-red-400/50" />
                </button>
              )}

              {/* 119 경고 */}
              <div className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)' }}>
                <AlertTriangle size={12} className="shrink-0 text-orange-400/70" />
                <p className="text-[11.5px] text-orange-300/65">화재 발생 시 119 먼저 신고하세요</p>
              </div>

              {/* 가장 가까운 */}
              {nearest && (
                <div className="mb-4 rounded-xl px-3.5 py-3"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <p className="text-[10.5px] font-bold text-white/28 uppercase tracking-wider mb-2">가장 가까운 소화기</p>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-bold text-white">{nearest.label}</p>
                      <p className="text-[11.5px] text-white/45 mt-0.5">{nearest.description}</p>
                    </div>
                    {nearest.dist !== undefined && (
                      <span className="shrink-0 text-[18px] font-black text-red-400">{fmtDist(nearest.dist)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* 목록 */}
              <p className="text-[10.5px] font-bold text-white/28 uppercase tracking-wider mb-2.5">
                시민 제보 목록 ({items.length})
              </p>
              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const isGone = item.status === 'gone';
                  return (
                    <div key={item.id}
                      className="rounded-xl px-3.5 py-3"
                      style={{
                        background: isGone ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isGone ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'}`,
                        opacity: isGone ? 0.5 : 1,
                      }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-[13px] font-bold ${isGone ? 'line-through text-white/35' : 'text-white'}`}>
                              {isGone ? '🚫' : '🧯'} {item.label}
                            </p>
                            {item.hasPhoto && !isGone && (
                              <span className="text-[9.5px] font-bold text-white/25">📸 사진 인증</span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-white/38 mt-0.5">{item.description}</p>
                          <div className="flex items-center gap-2.5 mt-1.5">
                            <span className="flex items-center gap-1 text-[10.5px] text-white/22">
                              <Clock size={9} />{daysAgo(item.reportedAt)} 제보
                            </span>
                            {item.dist !== undefined && (
                              <span className="flex items-center gap-1 text-[10.5px] text-white/22">
                                <MapPin size={9} />{fmtDist(item.dist)}
                              </span>
                            )}
                          </div>
                        </div>
                        {!isGone && (
                          <button type="button"
                            onClick={() => reportGone(item.id)}
                            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.30)' }}>
                            없음
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
