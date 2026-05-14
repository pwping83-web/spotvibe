import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronLeft, MapPinned } from 'lucide-react';
import {
  EXPLORE_METRO_GROUPS,
  presetsForMetro,
  type ExploreRegionPreset,
} from '@/app/constants/exploreRegions';

type Variant = 'map' | 'embedded';

export function ExploreRegionFlowPanel({
  explorePresets,
  onApply,
  variant,
}: {
  explorePresets: ExploreRegionPreset[];
  onApply: (preset: ExploreRegionPreset) => void;
  variant: Variant;
}) {
  const [expanded, setExpanded] = useState(variant === 'embedded');
  const [step, setStep] = useState<0 | 1>(0);
  const [metroId, setMetroId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const resetFlow = useCallback(() => {
    setStep(0);
    setMetroId(null);
    setPendingId(null);
  }, []);

  useEffect(() => {
    if (variant !== 'map') return;
    if (!expanded) resetFlow();
  }, [expanded, variant, resetFlow]);

  const handleConfirm = () => {
    const p = explorePresets.find((x) => x.id === pendingId);
    if (!p) return;
    onApply(p);
    if (variant === 'map') {
      setExpanded(false);
      resetFlow();
    }
  };

  const flowInner = (
    <>
      {step === 0 && (
        <>
          <p className="text-[11px] font-semibold text-[#FFDE00]">1단계 · 어느 광역을 볼까요?</p>
          <p className="text-[10.5px] leading-relaxed text-[#FFDE00]/75">
            광역을 고른 뒤, 그 안 동네를 골라요.
          </p>
          <div className="flex flex-wrap gap-2">
            {EXPLORE_METRO_GROUPS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMetroId(m.id);
                  setStep(1);
                  setPendingId(null);
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[12px] font-bold text-white/75 transition-all active:scale-[0.99] hover:border-[#FFDE00]/35 hover:text-[#FFDE00]"
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 1 && metroId && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStep(0);
                setMetroId(null);
                setPendingId(null);
              }}
              className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-[10.5px] font-semibold text-white/60 transition-all active:scale-[0.98] hover:text-white/85"
            >
              <ChevronLeft size={14} strokeWidth={2.4} />
              광역
            </button>
            <p className="min-w-0 flex-1 text-[11px] font-semibold text-[#FFDE00]">
              2단계 · {EXPLORE_METRO_GROUPS.find((g) => g.id === metroId)?.label ?? ''} 안에서 골라요
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {presetsForMetro(metroId, explorePresets).map((p) => {
              const on = pendingId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPendingId(p.id)}
                  className="rounded-xl border px-3 py-2 text-[11.5px] font-semibold transition-all active:scale-[0.99]"
                  style={{
                    borderColor: on ? 'rgba(255,222,0,0.65)' : 'rgba(255,255,255,0.1)',
                    backgroundColor: on ? 'rgba(255,222,0,0.18)' : 'rgba(255,255,255,0.04)',
                    color: on ? '#FFDE00' : 'rgba(255,255,255,0.55)',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!pendingId}
            onClick={handleConfirm}
            className="flex w-full items-center justify-center rounded-xl border border-[#FFDE00]/45 bg-[#FFDE00]/14 py-2.5 text-[12.5px] font-bold text-[#FFDE00] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
          >
            확인 · 지도에서 이 지역 보기
          </button>
        </>
      )}
    </>
  );

  if (variant === 'embedded') {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="mt-3 space-y-3 rounded-xl border border-[#FFDE00]/20 bg-[#FFDE00]/06 px-3 py-3"
      >
        {flowInner}
      </motion.div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left shadow-lg backdrop-blur-md transition-all active:scale-[0.99] ${
          expanded
            ? 'border-[#FFDE00]/50 bg-[#FFDE00]/14'
            : 'border-[#FFDE00]/28 bg-[#0A0A0E]/92'
        }`}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(255,222,0,0.12)' }}
        >
          <MapPinned size={18} className="text-[#FFDE00]" strokeWidth={2.2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-bold ${expanded ? 'text-[#FFDE00]' : 'text-white/88'}`}>
            다른 지역 알아보기
          </p>
          <p className="text-[10.5px] leading-snug text-white/38">
            광역 → 동네 순으로 고른 뒤 확인하면 이 지도로 이동해요
          </p>
        </div>
        <ChevronDown
          size={18}
          strokeWidth={2.2}
          className={`shrink-0 text-[#FFDE00]/80 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-2xl border border-[#FFDE00]/22 bg-[#0A0A0E]/95 shadow-xl backdrop-blur-md"
          >
            <div className="max-h-[min(48vh,380px)] space-y-3 overflow-y-auto px-3 py-3">{flowInner}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
