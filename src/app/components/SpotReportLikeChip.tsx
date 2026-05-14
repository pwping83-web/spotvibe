import React from 'react';
import { Heart, Loader2 } from 'lucide-react';

export function SpotReportLikeChip({
  count,
  liked,
  disabled,
  busy,
  onClick,
  compact,
}: {
  count: number;
  liked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  /** 썸네일 위 오버레이용 */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex items-center gap-1 rounded-full border font-bold transition-all active:scale-[0.96] disabled:opacity-40 ${
        compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'
      }`}
      style={{
        borderColor: liked ? 'rgba(255,107,107,0.55)' : 'rgba(255,255,255,0.14)',
        backgroundColor: liked ? 'rgba(255,107,107,0.14)' : 'rgba(0,0,0,0.45)',
        color: liked ? '#FF6B6B' : 'rgba(255,255,255,0.75)',
        boxShadow: liked ? '0 0 12px rgba(255,107,107,0.22)' : undefined,
      }}
      aria-pressed={liked}
      aria-label={liked ? '좋아요 취소' : '좋아요'}
    >
      {busy ? (
        <Loader2 size={compact ? 12 : 14} className="animate-spin" aria-hidden />
      ) : (
        <Heart size={compact ? 12 : 14} fill={liked ? 'currentColor' : 'none'} strokeWidth={2.2} aria-hidden />
      )}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
