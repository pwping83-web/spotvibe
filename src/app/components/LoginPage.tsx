import React from 'react';
import { motion } from 'motion/react';
import { Waves } from 'lucide-react';

function KakaoSymbol({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 22" width="20" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M12 0C5.373 0 0 3.582 0 8c0 2.81 1.91 5.29 4.804 6.735L3.6 21.6l5.044-2.77c1.08.3 2.22.464 3.356.464 6.627 0 12-3.582 12-8S18.627 0 12 0z"
      />
    </svg>
  );
}

export interface LoginPageProps {
  onLoginSuccess: () => void;
}

async function signInWithKakaoOAuth(): Promise<void> {
  await Promise.resolve();
}

/**
 * 레이더(큰 시안 블러·펄스 링·중심 점)를 번개 아이콘 열에 맞춤.
 * 양수 X = 오른쪽, 음수 Y = 위쪽.
 */
const LOGIN_RADAR_EVENT_SHIFT_X_PX = 4;
const LOGIN_RADAR_EVENT_SHIFT_Y_PX = -10;

/** 번개 이모지: 박스 중심보다 살짝 위가 시각 중심 (박스 로컬 좌표만) */
const EVENT_LIGHTNING_GLOW_NUDGE_Y_PX = -6;

const RADAR_ANCHOR_PX = 300;

/** 중앙에서 밖으로 퍼지는 레이더 링 */
function RadarRings() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {/* 자식이 전부 absolute일 때 래퍼가 0×0이 되지 않도록 앵커 박스 고정 */}
      <div
        className="absolute"
        style={{
          left: `calc(50% + ${LOGIN_RADAR_EVENT_SHIFT_X_PX}px)`,
          top: `calc(50% + ${LOGIN_RADAR_EVENT_SHIFT_Y_PX}px)`,
          width: RADAR_ANCHOR_PX,
          height: RADAR_ANCHOR_PX,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="relative h-full w-full">
          <div
            className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[72px]"
            style={{ background: 'radial-gradient(circle, rgba(0,240,255,0.09) 0%, transparent 70%)' }}
          />
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: 60 + i * 56, height: 60 + i * 56, border: '1px solid rgba(0,240,255,0.14)' }}
              animate={{ scale: [0.72, 1.7], opacity: [0.22, 0] }}
              transition={{ duration: 3.6, repeat: Infinity, delay: i * 0.85, ease: [0.12, 0, 0.48, 1] }}
            />
          ))}
          <motion.div
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: '#00F0FF', boxShadow: '0 0 0 3px rgba(0,240,255,0.12), 0 0 16px rgba(0,240,255,0.5)' }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
  );
}

/** 천천히 위아래로 떠다니는 네온 배경 불빛 */
const ORBS = [
  { id: 0, x: 18,  baseY: 38, color: 'rgba(0,240,255,0.13)',   size: 220, dur: 6.2, delay: 0    },
  { id: 1, x: 72,  baseY: 42, color: 'rgba(168,85,247,0.11)',  size: 190, dur: 7.8, delay: 1.4  },
  { id: 2, x: 48,  baseY: 55, color: 'rgba(255,107,107,0.09)', size: 170, dur: 5.5, delay: 0.7  },
  { id: 3, x: 30,  baseY: 62, color: 'rgba(255,222,0,0.07)',   size: 140, dur: 8.4, delay: 2.1  },
  { id: 4, x: 82,  baseY: 30, color: 'rgba(0,240,255,0.08)',   size: 155, dur: 6.9, delay: 3.3  },
] as const;

function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {ORBS.map((o) => (
        <motion.div
          key={o.id}
          className="absolute rounded-full"
          style={{
            left: `${o.x}%`,
            top: `${o.baseY}%`,
            width: o.size,
            height: o.size,
            background: `radial-gradient(circle at 40% 40%, ${o.color}, transparent 70%)`,
            translateX: '-50%',
            translateY: '-50%',
            filter: 'blur(38px)',
          }}
          animate={{ y: ['-14px', '14px', '-14px'] }}
          transition={{
            duration: o.dur,
            repeat: Infinity,
            delay: o.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/** 천천히 낙하하는 미세 입자 */
const PARTICLES = [
  { id: 0, x: 15,  delay: 0,   dur: 9.0, size: 1.5, op: 0.18 },
  { id: 1, x: 28,  delay: 1.6, dur: 7.5, size: 1,   op: 0.12 },
  { id: 2, x: 47,  delay: 0.8, dur: 10,  size: 2,   op: 0.16 },
  { id: 3, x: 62,  delay: 2.4, dur: 8.2, size: 1.5, op: 0.13 },
  { id: 4, x: 78,  delay: 3.7, dur: 9.4, size: 2,   op: 0.15 },
  { id: 5, x: 38,  delay: 1.2, dur: 8.0, size: 1,   op: 0.11 },
  { id: 6, x: 70,  delay: 0.4, dur: 10.2,size: 1.5, op: 0.14 },
  { id: 7, x: 88,  delay: 2.0, dur: 8.8, size: 1,   op: 0.10 },
  { id: 8, x: 55,  delay: 4.2, dur: 9.6, size: 2,   op: 0.13 },
];

function Particles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute top-0 rounded-full bg-white"
          style={{ left: `${p.x}%`, width: p.size, height: p.size, opacity: 0 }}
          animate={{ y: ['0vh', '105vh'], opacity: [0, p.op, p.op, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'linear', times: [0, 0.08, 0.88, 1] }}
        />
      ))}
    </div>
  );
}

const FEATURES = [
  { emoji: '📍', label: '실시간 지도', sub: '연령·핫스팟' },
  { emoji: '⚡', label: '이벤트', sub: '주변 행사' },
  { emoji: '🔔', label: '맞춤 알림', sub: '내 시간대' },
] as const;

/** 테두리 릴레이 제거 — 카드마다 은은한 ambient 글로우가 순서대로 페이드 */
const RELAY_MS = 2400;

const GLOW_COLORS = [
  'rgba(120,200,255,0.18)',   // 지도 — 옅은 하늘
  'rgba(255,255,255,0.07)',  // 이벤트 — 전용 시안 글로우와 겹치지 않게 은은한 흰 릴레이만
  'rgba(180,160,255,0.16)',   // 알림 — 연보라
] as const;

function FeatureIconBox({
  emoji,
  index,
  relayPhase,
  isEvent,
}: {
  emoji: string;
  index: number;
  relayPhase: number;
  isEvent: boolean;
}) {
  const active = relayPhase === index;

  return (
    <div className="relative flex h-12 w-12 items-center justify-center">

      {/* 이벤트: 시안 글로우 — 아이콘 박스 중심 + 번개 시각 중심만 위로 (레이더는 LOGIN_RADAR_* 로 별도 정렬) */}
      {isEvent && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-visible" aria-hidden>
          <div
            className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full"
            style={{
              transform: `translate(-50%, calc(-50% + ${EVENT_LIGHTNING_GLOW_NUDGE_Y_PX}px))`,
              background:
                'radial-gradient(circle at 50% 44%, rgba(0,240,255,0.34) 0%, rgba(0,240,255,0.1) 48%, transparent 70%)',
              filter: 'blur(8px)',
            }}
          />
        </div>
      )}

      {/* 릴레이 ambient 글로우 — 차례일 때 살짝 페이드인·아웃 */}
      <motion.div
        className="pointer-events-none absolute inset-[-6px] z-[1] rounded-[18px]"
        aria-hidden
        style={{
          zIndex: 1,
          background: `radial-gradient(circle at 50% 50%, ${GLOW_COLORS[index]}, transparent 72%)`,
          filter: 'blur(8px)',
        }}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.9, ease: 'easeInOut' }}
      />

      {/* 아이콘 박스 */}
      <div
        className="relative z-[2] flex h-full w-full items-center justify-center rounded-2xl text-xl"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: isEvent
            ? '1px solid rgba(0,240,255,0.14)'
            : '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {emoji}
      </div>
    </div>
  );
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [pending, setPending] = React.useState(false);
  const [relayPhase, setRelayPhase] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setRelayPhase((p) => (p + 1) % FEATURES.length);
    }, RELAY_MS);
    return () => window.clearInterval(id);
  }, []);

  const handleKakaoClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await signInWithKakaoOAuth();
      onLoginSuccess();
    } catch {
      setPending(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-[#0A0A0E] text-white">
      <FloatingOrbs />
      <Particles />

      {/* 배경 도트 그리드 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.028]"
        aria-hidden
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,1) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">

        {/* ─ 상단: 태그 + 타이틀 */}
        <div className="flex shrink-0 flex-col items-center pt-[min(16vh,7rem)]">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }} className="text-center px-8">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] text-white/40">
              <Waves className="h-3 w-3 text-cyan-400/70" aria-hidden />
              주변 핫스팟 · 실시간
            </div>
            <h1 className="text-[2.6rem] font-black tracking-[-0.02em] text-white" style={{ textShadow: '0 0 40px rgba(0,240,255,0.18)' }}>
              스팟바이브
            </h1>
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/42">
              지금 이 동네, 가장 핫한 바이브를<br />지도와 이벤트로 한눈에
            </p>
          </motion.div>
        </div>

        {/* ─ 중앙: 레이더 + 피처 */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <RadarRings />

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.12, duration: 0.4 }}
            className="relative z-[1] flex items-end justify-center gap-8"
          >
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.06, duration: 0.3 }}
                className="flex flex-col items-center gap-2"
              >
                <FeatureIconBox
                  emoji={f.emoji}
                  index={i}
                  relayPhase={relayPhase}
                  isEvent={f.label === '이벤트'}
                />
                <p className="text-[12px] font-semibold text-white/80">{f.label}</p>
                <p className="text-[10px] text-white/35">{f.sub}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* ─ 구분선 */}
        <div className="mx-auto mb-6 h-px w-[180px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* ─ 하단: 버튼 */}
      <div className="relative z-10 w-full shrink-0 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.36 }}
          className="mx-auto w-full max-w-[340px]"
        >
          <button
            type="button"
            onClick={handleKakaoClick}
            disabled={pending}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-[15px] text-[15px] font-bold text-[#191600] transition-opacity active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: '#FEE500', boxShadow: '0 4px 24px rgba(254,229,0,0.22)' }}
          >
            <KakaoSymbol className="shrink-0" />
            {pending ? '연결 중…' : '카카오로 시작하기'}
          </button>
          <p className="mt-3.5 text-center text-[10.5px] leading-relaxed text-white/25">
            로그인 시 서비스 이용약관 및 개인정보 처리에 동의하게 됩니다.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
