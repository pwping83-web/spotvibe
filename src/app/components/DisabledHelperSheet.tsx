/**
 * 취약계층 이웃 도움 연결 안내 시트
 */
import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

interface DisabledHelperSheetProps {
  open: boolean;
  onClose: () => void;
}

const MARKERS = [
  { emoji: '\uD83E\uDDB0', label: '\uC2DC\uAC01\uC7A5\uC560\uC778', desc: '\uAD6C\uCCAD \uC2B9\uC778 \uD6C4 \uC0C1\uC2DC \uC704\uCE58 \uACF5\uC720 \u00B7 100m \uB0B4 \uC774\uC6C3 \uC54C\uB9BC', special: true },
  { emoji: '\uD83E\uDDB6', label: '\uCCAD\uAC01\uC7A5\uC560\uC778', desc: '\uAD6C\uCCAD \uC2B9\uC778 \uD6C4 \uC0C1\uC2DC \uC704\uCE58 \uACF5\uC720 \u00B7 100m \uB0B4 \uC774\uC6C3 \uC54C\uB9BC', special: false },
  { emoji: '\u267F', label: '\uC774\uB3D9\uC57D\uC790', desc: '\uAD6C\uCCAD \uC2B9\uC778 \uD6C4 \uC0C1\uC2DC \uC704\uCE58 \uACF5\uC720 \u00B7 100m \uB0B4 \uC774\uC6C3 \uC54C\uB9BC', special: false },
  { emoji: '\uD83C\uDFE0', label: '\uB3C5\uAC70\uB178\uC778', desc: '\uC9C0\uC790\uCCB4 \uBCF5\uC9C0 \uC5F0\uACC4 \uB4F1\uB85D \u00B7 100m \uB0B4 \uC774\uC6C3 \uC54C\uB9BC', special: false },
  { emoji: '\u26A0\uFE0F', label: '\uBBF8\uC544\u00B7\uC2E4\uC885', desc: '\uC2E4\uC885 \uC2E0\uACE0 \uC5F0\uACC4 \u00B7 300m \uB0B4 \uC774\uC6C3 \uC54C\uB9BC', special: false },
] as const;

export function DisabledHelperSheet({ open, onClose }: DisabledHelperSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="dh-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="dh-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[601] max-h-[80vh] overflow-y-auto rounded-t-3xl"
            style={{
              background: 'rgba(12,12,20,0.98)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
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
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[17px] font-black text-white">{'\uC774\uC6C3 \uB3C4\uC6C0 \uC5F0\uACB0'}</p>
                  <p className="text-[12px] text-white/40 mt-0.5">{'\uC571\uC774 \uCF1C\uC9C4 \uC774\uC6C3\uC5D0\uAC8C \uCDE8\uC57D\uACC4\uCE35 \uC704\uCE58\uB97C \uC54C\uB824 \uB3C4\uC6C0\uC744 \uC5F0\uACB0\uD569\uB2C8\uB2E4'}</p>
                </div>
                <button type="button" onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/40">
                  <X size={15} />
                </button>
              </div>

              <div className="flex flex-col gap-2 mb-5">
                {MARKERS.map((m) => (
                  <div
                    key={m.label}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-3"
                    style={
                      m.special
                        ? { background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.28)' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }
                    }
                  >
                    <span className="text-[20px] leading-none">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white flex items-center gap-2">
                        {m.label}
                        {m.special && (
                          <span className="text-[10px] font-bold rounded-md px-1.5 py-0.5"
                            style={{ background: 'rgba(59,130,246,0.2)', color: '#93C5FD' }}>
                            {'\uD2B9\uBCC4\uB9C8\uCEE4'}
                          </span>
                        )}
                      </p>
                      <p className="text-[11.5px] text-white/45 mt-0.5">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl px-4 py-3 mb-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[12px] font-semibold text-white/55 mb-2">{'\uB4F1\uB85D \uC2E0\uCCAD'}</p>
              <p className="text-[12px] text-white/38 leading-relaxed">
                {'\uBCF8\uC778\u00B7\uBCF4\uD638\uC790\uAC00 \uAC00\uAE4C\uC6B4 \uAD6C\uCCAD\u00B7\uC8FC\uBBFC\uC13C\uD130\uC5D0\uC11C \uC2E0\uCCAD \u2192 \uB2F4\uB2F9\uC790 \uC2B9\uC778 \u2192 \uC571 \uC704\uCE58 \uACF5\uC720 \uB3D9\uC758'}
                {' '}지도의 🦯 마커를 누르면 이웃이 짧은 위험 안내(예: 공사 구간)를 보낼 수 있어요. 수신은 마이페이지「이웃 도움 음성」에서 켜야 합니다.
              </p>
              </div>

              <p className="text-[11px] text-white/22 leading-relaxed">
                {'\uACF5\uC2DD \uC751\uAE09\uAE30\uAD00\uC744 \uB300\uCCB4\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE34\uAE09 \uC0C1\uD669\uC740 119\u00B7112\uC5D0 \uBA3C\uC800 \uC2E0\uACE0\uD558\uC138\uC694. \uC704\uCE58 \uC815\uBCF4\uB294 \uB2F9\uC0AC\uC790 \uB3D9\uC758 \uBC0F \uAE30\uAD00 \uC2B9\uC778 \uD6C4\uC5D0\uB9CC \uACF5\uC720\uB429\uB2C8\uB2E4.'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
