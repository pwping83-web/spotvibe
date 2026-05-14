/**
 * 시설물 마커 클릭 시 — 제보 사진·신고 시트
 * - 신고 5회 누적 시 자동 삭제
 */
import React from 'react';
import { motion } from 'motion/react';
import { X, AlertTriangle, MapPin, Clock } from 'lucide-react';
import { TOILET_MAP_ICON } from './ToiletSheet';
import { OUTDOOR_GYM_MAP_ICON } from './FacilityCategorySheet';

export interface MarkerItem {
  id: string;
  type: 'fire' | 'toilet' | 'gym' | 'trash' | 'smoking';
  emoji: string;
  /** 공공 쓰레기통·흡연실·야외운동 등 — 지도·시트에서 SVG 픽토그램 표시 */
  mapIconSrc?: string | null;
  /** 데모 데이터: 지도 핀만 탐색 중심 주변에 배치(원문 좌표와 다를 수 있음) */
  demoAroundCenter?: boolean;
  label: string;
  description: string;
  dist: number;
  reportedAt: string;
  reporterName: string;
  photoUrl: string | null;
  reportCount: number;
  gone: boolean;
  lat: number;
  lng: number;
}

interface MarkerPhotoSheetProps {
  item: MarkerItem | null;
  onClose: () => void;
  onReport: (id: string) => void;   // 신고 +1
  onDelete: (id: string) => void;   // 5회 → 자동 삭제
}

const MAX_REPORTS = 5;

function fmtDist(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

function daysAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (diff === 0) return '오늘';
  if (diff < 30) return `${diff}일 전`;
  return `${Math.floor(diff / 30)}개월 전`;
}

export function MarkerPhotoSheet({ item, onClose, onReport, onDelete }: MarkerPhotoSheetProps) {
  const open = !!item;

  const handleReport = () => {
    if (!item) return;
    const next = item.reportCount + 1;
    if (next >= MAX_REPORTS) {
      onDelete(item.id);
      onClose();
    } else {
      onReport(item.id);
    }
  };

  const headerPictoSrc =
    item?.type === 'toilet'
      ? item.mapIconSrc || TOILET_MAP_ICON
      : item?.type === 'gym'
        ? item.mapIconSrc || OUTDOOR_GYM_MAP_ICON
        : item?.type === 'trash' || item?.type === 'smoking'
          ? item.mapIconSrc
          : null;

  const accentColor = item?.type === 'fire'
    ? { border: 'rgba(239,68,68,0.22)', text: '#F87171' }
    : item?.type === 'gym'
      ? { border: 'rgba(52,211,153,0.22)', text: '#34D399' }
      : item?.type === 'trash'
        ? { border: 'rgba(148,163,184,0.28)', text: '#94A3B8' }
        : item?.type === 'smoking'
          ? { border: 'rgba(245,158,11,0.28)', text: '#FBBF24' }
          : { border: 'rgba(34,197,94,0.22)', text: '#4ADE80' };

  return (
    <>
      {open && item && (
        <>
          <div
            key="mp-bg"
            className="fixed inset-0 z-[610] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="mp-sheet"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-[611] rounded-t-3xl"
            style={{ background: 'rgba(12,12,20,0.99)', borderTop: `1px solid ${accentColor.border}` }}
          >
            {/* 핸들 */}
            <button type="button" onClick={onClose} className="flex w-full justify-center pt-3 pb-2" aria-label="닫기">
              <span className="block h-1 w-12 rounded-full bg-white/18" />
            </button>

            <div className="px-5 pb-[calc(5.5rem+0.75rem)]">
              {/* 헤더 */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {headerPictoSrc ? (
                    <img
                      src={headerPictoSrc}
                      alt=""
                      width={item.type === 'smoking' || item.type === 'gym' ? 40 : 36}
                      height={item.type === 'smoking' || item.type === 'gym' ? 40 : 36}
                      className={
                        item.type === 'smoking' || item.type === 'gym'
                          ? 'h-10 w-10 shrink-0 rounded-lg border border-white/10 bg-white/5 object-contain p-0.5'
                          : 'h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-white/5 object-contain p-0.5'
                      }
                    />
                  ) : (
                    <span className="text-[20px]">{item.emoji}</span>
                  )}
                  <div>
                    <p className="text-[15px] font-black text-white">{item.label}</p>
                    <div className="flex items-center gap-2.5 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] text-white/30">
                        <MapPin size={9} />{fmtDist(item.dist)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-white/30">
                        <Clock size={9} />{daysAgo(item.reportedAt)}
                      </span>
                      <span className="text-[11px] text-white/25">by {item.reporterName}</span>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/35">
                  <X size={13} />
                </button>
              </div>

              {/* 제보 사진 */}
              {item.photoUrl ? (
                <div
                  className="mb-4 flex items-center justify-center overflow-hidden rounded-2xl"
                  style={{ maxHeight: 320, minHeight: 220, background: 'rgba(255,255,255,0.03)' }}
                >
                  <img
                    src={item.photoUrl}
                    alt="제보 사진"
                    className="h-full w-full object-contain"
                    style={{ maxHeight: 320 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="mb-4 flex h-32 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.10)' }}>
                  <p className="text-[12px] text-white/25">사진 없음</p>
                </div>
              )}

              {/* 설명 */}
              <p className="mb-4 text-[12.5px] text-white/45 leading-snug">{item.description}</p>

              {/* 신고 */}
              <div className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <p className="text-[12px] font-bold text-white/50">위치가 잘못됐나요?</p>
                  <p className="text-[11px] text-white/28 mt-0.5">
                    신고 {item.reportCount}/{MAX_REPORTS}회 · {MAX_REPORTS}회 누적 시 자동 삭제
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReport}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold"
                  style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.28)', color: '#FCD34D' }}
                >
                  <AlertTriangle size={12} />
                  신고
                </button>
              </div>

              {/* 신고 진행 바 */}
              {item.reportCount > 0 && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(item.reportCount / MAX_REPORTS) * 100}%`,
                      background: item.reportCount >= 3 ? '#EF4444' : '#FCD34D',
                    }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </>
  );
}
