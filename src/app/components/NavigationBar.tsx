import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map, Zap, Bell, User } from 'lucide-react';

export type TabKey = 'map' | 'events' | 'notifications' | 'my';

interface NavigationBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const NAV_ITEMS: { key: TabKey; icon: typeof Map; label: string; accent: string }[] = [
  { key: 'map',           icon: Map,  label: '지도',   accent: '#00F0FF' },
  { key: 'events',        icon: Zap,  label: '이벤트', accent: '#FFDE00' },
  { key: 'notifications', icon: Bell, label: '알림',   accent: '#FF6B6B' },
  { key: 'my',            icon: User, label: '마이',   accent: '#00F0FF' },
];

export function NavigationBar({ active, onChange }: NavigationBarProps) {
  return (
    <div
      className="absolute bottom-0 left-0 z-30 flex w-full flex-col items-stretch gap-1.5 px-5 pb-5 pointer-events-none"
      style={{ background: 'linear-gradient(to top, #0A0A0E 0%, #0A0A0Ecc 55%, transparent 100%)' }}
    >
      {/* 사업자정보/서비스 안내 문구 숨김 */}
      <nav
        className="pointer-events-auto w-full flex items-center justify-around rounded-[22px] border border-white/[0.08] bg-[#141420]/92 px-2 py-2 shadow-2xl backdrop-blur-2xl"
        style={{ boxShadow: '0 -1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.55)' }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className="relative flex flex-1 flex-col items-center gap-1 py-1 transition-transform active:scale-95"
            >
              {/* 활성 탭 pill 배경 */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-x-1 inset-y-0 rounded-[14px]"
                    style={{ backgroundColor: `${item.accent}12` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </AnimatePresence>

              {/* 아이콘 */}
              <div className="relative z-[1]">
                <Icon
                  size={21}
                  strokeWidth={isActive ? 2 : 1.6}
                  style={{ color: isActive ? item.accent : 'rgba(255,255,255,0.35)' }}
                />
                {/* 활성 글로우 점 */}
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: item.accent, boxShadow: `0 0 6px ${item.accent}` }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </div>

              {/* 레이블 */}
              <span
                className="relative z-[1] text-[10px] font-semibold transition-colors"
                style={{ color: isActive ? item.accent : 'rgba(255,255,255,0.3)' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
