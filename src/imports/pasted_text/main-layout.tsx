📂 1. 메인 레이아웃 (src/app/App.tsx)
수정 포인트: 상단 헤더의 영문(Live Map)을 한국어로 변경하고 텍스트의 사이버틱한 그라데이션을 조금 더 부드럽게 다듬었습니다.

TypeScript
import React, { useState } from 'react';
import { MapArea } from './components/MapArea';
import { BottomSheet } from './components/BottomSheet';
import { NavigationBar } from './components/NavigationBar';

export default function App() {
  const [showAIInsight, setShowAIInsight] = useState(false);

  return (
    <div className="relative w-full h-screen bg-[#0A0A0E] text-white overflow-hidden font-sans flex flex-col items-center">
      {/* Mobile Device Simulation Container */}
      <div className="relative w-full h-full max-w-[430px] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Top Status Bar (Fake) */}
        <div className="absolute top-0 w-full h-12 z-20 flex justify-between items-center px-6 pointer-events-none text-white/80 text-xs font-medium">
          <span>9:41</span>
          <div className="flex gap-2">
            <div className="w-4 h-3 bg-white/80 rounded-[2px]" />
            <div className="w-4 h-3 bg-white/80 rounded-[2px]" />
          </div>
        </div>

        {/* Floating Top Bar (App Identity) */}
        <div className="absolute top-14 left-0 w-full z-20 px-5 pointer-events-none">
          <div className="bg-[#1A1A24]/80 backdrop-blur-md border border-white/10 rounded-full px-5 py-3 flex items-center justify-between pointer-events-auto shadow-lg">
            <h1 className="text-xl font-bold tracking-tight text-white">
              SpotVibe
            </h1>
            <div className="flex items-center gap-2 bg-black/40 rounded-full px-3 py-1 border border-white/5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-medium text-white/90">실시간 지도</span>
            </div>
          </div>
        </div>

        {/* Main Map View */}
        <div className="flex-1 relative w-full h-full cursor-pointer">
          <MapArea onClusterClick={() => setShowAIInsight(true)} />
        </div>

        {/* Bottom Navigation */}
        <NavigationBar />

        {/* AI Inference Bottom Sheet */}
        <BottomSheet 
          isOpen={showAIInsight} 
          onClose={() => setShowAIInsight(false)} 
        />
      </div>
    </div>
  );
}
📂 2. 지도 및 마커 (src/app/components/MapArea.tsx)
수정 포인트: 'VIBE SURGE', 'Time Sale' 같은 딱딱한 영문을 친근한 한국어로 바꾸고, 과도하게 눈이 아픈 이펙트를 살짝 줄여 데이터가 세련되게 보이도록 했습니다.

TypeScript
import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Zap, Flame } from 'lucide-react';

interface MapAreaProps {
  onClusterClick: () => void;
}

export function MapArea({ onClusterClick }: MapAreaProps) {
  const generateDots = (colorClass: string, count: number, excludeCenter: boolean = false) => {
    return Array.from({ length: count }).map((_, i) => {
      let top = Math.random() * 100;
      let left = Math.random() * 100;
      
      if (excludeCenter) {
        while (top > 40 && top < 70 && left > 20 && left < 80) {
          top = Math.random() * 100;
          left = Math.random() * 100;
        }
      }
      const size = Math.random() * 3 + 2;
      return (
        <motion.div
          key={`${colorClass}-${i}`}
          className={`absolute rounded-full ${colorClass} mix-blend-screen`}
          style={{
            top: `${top}%`,
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            boxShadow: `0 0 ${size}px currentColor`,
          }}
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
          transition={{ duration: Math.random() * 2 + 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      );
    });
  };

  return (
    <div className="absolute inset-0 bg-[#12121A] overflow-hidden">
      {/* Background Map Texture */}
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
      
      {/* Scattered Users */}
      {generateDots("bg-[#FFDE00] text-[#FFDE00]", 35, true)} {/* 20대 노랑 */}
      {generateDots("bg-[#FF6B6B] text-[#FF6B6B]", 25, true)} {/* 30대 코랄 */}

      {/* 40s Cluster - 한강공원 에어로빅 구역 */}
      <div className="absolute top-[45%] left-[20%] w-[60%] h-[20%] cursor-pointer group z-10" onClick={onClusterClick}>
        {/* Heatmap Glow */}
        <motion.div
          className="absolute inset-0 rounded-[100px] bg-[#00F0FF]/15 blur-[30px] mix-blend-screen"
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        {/* Dense dots */}
        {Array.from({ length: 45 }).map((_, i) => (
          <motion.div
            key={`cluster-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-[#00F0FF] shadow-[0_0_5px_#00F0FF] mix-blend-screen"
            style={{ top: `${30 + Math.random() * 40}%`, left: `${10 + Math.random() * 80}%` }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: Math.random() * 2 + 1, repeat: Infinity }}
          />
        ))}
        {/* Interaction Hint */}
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-[#1A1A24]/90 px-3 py-1.5 rounded-full border border-[#00F0FF]/30 text-[#00F0FF] text-[11px] font-bold flex items-center gap-1.5">
            <Flame size={12} fill="currentColor" />
            인구 밀집 구역
          </div>
        </motion.div>
      </div>

      {/* Local Event Pin 1 */}
      <motion.div className="absolute top-[38%] left-[65%] flex flex-col items-center z-20" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="relative bg-[#FFDE00] text-black p-2 rounded-full shadow-lg">
          <MapPin size={16} className="fill-black" />
        </div>
        <div className="mt-1 bg-[#1A1A24]/90 px-2.5 py-1 rounded-md text-[10px] font-bold text-[#FFDE00] border border-[#FFDE00]/30 whitespace-nowrap">
          플리마켓 타임세일
        </div>
      </motion.div>

      {/* Local Event Pin 2 */}
      <motion.div className="absolute top-[65%] left-[30%] flex flex-col items-center z-20" initial={{ scale: 0 }} animate={{ scale: 1 }}>
        <div className="relative bg-[#FF6B6B] text-white p-1.5 rounded-full shadow-lg">
          <Zap size={14} className="fill-white" />
        </div>
        <div className="mt-1 bg-[#1A1A24]/90 px-2.5 py-1 rounded-md text-[10px] font-bold text-[#FF6B6B] border border-[#FF6B6B]/30 whitespace-nowrap">
          인디 밴드 버스킹
        </div>
      </motion.div>
    </div>
  );
}
📂 3. AI 알림 팝업 (src/app/components/BottomSheet.tsx)
수정 포인트: 기획하신 "40대 여성 한강 에어로빅" 상황을 반영하여 AI 추천 문구를 작성했습니다. 무서운 AI 느낌 대신 똑똑한 비서 느낌을 주었습니다.

TypeScript
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, MapPin, Users, Navigation } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BottomSheet({ isOpen, onClose }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 w-full bg-[#1A1A24] border-t border-white/10 rounded-t-3xl p-6 z-50 shadow-2xl"
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
            <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="bg-[#00F0FF]/15 p-2 rounded-xl">
                <Sparkles size={18} className="text-[#00F0FF]" />
              </div>
              <h2 className="text-lg font-bold text-white">AI 핫스팟 분석</h2>
            </div>

            <div className="space-y-5">
              <p className="text-white/80 text-[15px] leading-relaxed font-medium">
                현재 <span className="text-[#00F0FF] font-bold">여의도 한강공원</span> 부근에 <span className="text-[#00F0FF] font-bold">40대 유저</span> 밀집도가 급증했어요! <br/>
                오전 무료 에어로빅 강좌나 야외 모임이 진행 중일 확률이 높습니다. 활기찬 현장으로 가보시겠어요?
              </p>

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                  <MapPin size={12} className="text-[#00F0FF]" />
                  <span>여의도 한강공원 수변광장</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                  <Users size={12} className="text-[#00F0FF]" />
                  <span>현재 120명 이상 밀집</span>
                </div>
              </div>

              <button
                className="w-full mt-2 bg-[#00F0FF] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#00D0FF] active:scale-[0.98] transition-all"
                onClick={onClose}
              >
                <Navigation size={18} />
                <span>현장으로 경로 안내받기</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
📂 4. 하단 네비게이션 (src/app/components/NavigationBar.tsx)
수정 포인트: 모임(채팅) 기능을 배제하기로 한 기획 원칙에 따라 'Chat(채팅)' 아이콘을 알림(Bell) 아이콘으로 변경하고, 한국어 라벨로 교체했습니다.

TypeScript
import React from 'react';
import { Map, Zap, Bell, User } from 'lucide-react';

export function NavigationBar() {
  const navItems = [
    { icon: Map, label: '지도', active: true, color: 'text-[#00F0FF]' },
    { icon: Zap, label: '이벤트', active: false },
    { icon: Bell, label: '알림', active: false },
    { icon: User, label: '마이', active: false },
  ];

  return (
    <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#0A0A0E] via-[#0A0A0E]/80 to-transparent z-30 pb-6 px-6 flex items-end justify-between pointer-events-none">
      <div className="w-full flex justify-between items-center bg-[#1A1A24]/90 backdrop-blur-xl border border-white/10 rounded-full px-8 py-3.5 pointer-events-auto shadow-xl">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              className={`flex flex-col items-center gap-1.5 transition-all ${item.active ? 'scale-105' : 'opacity-40 hover:opacity-100'}`}
            >
              <div className="relative">
                <Icon size={22} className={item.active ? item.color : 'text-white'} />
              </div>
              <span className={`text-[10px] font-semibold ${item.active ? item.color : 'text-white'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}