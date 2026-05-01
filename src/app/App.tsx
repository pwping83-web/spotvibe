import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { MapArea } from './components/MapArea';
import { BottomSheet } from './components/BottomSheet';
import { NavigationBar, TabKey } from './components/NavigationBar';
import { EventsPage } from './components/EventsPage';
import { NotificationsPage } from './components/NotificationsPage';
import { MyPage, type MobilityProfile } from './components/MyPage';
import { LoginPage } from './components/LoginPage';

const TAB_LABEL: Record<TabKey, string> = {
  map: '지도',
  events: '이벤트',
  notifications: '알림',
  my: '마이',
};

type AuthContextValue = {
  isLoggedIn: boolean;
  /** Supabase OAuth 성공 후 호출 (현재는 카카오 버튼 플로우에서 직접 호출) */
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const login = useCallback(() => {
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
  }, []);

  const value = useMemo(
    () => ({ isLoggedIn, login, logout }),
    [isLoggedIn, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 현재 시각 HH:MM — 1분마다 갱신 */
function useLiveClock(): string {
  const fmt = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  const [time, setTime] = React.useState(fmt);
  React.useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 10_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/** 하단 탭 + 지도 등 메인 셸 */
function SpotVibeMain() {
  const clock = useLiveClock();
  const [showAIInsight, setShowAIInsight] = useState(false);
  const [tab, setTab] = useState<TabKey>('map');
  const [mobilityProfile, setMobilityProfile] = useState<MobilityProfile>(
    'pedestrian_ddareungi',
  );
  /** MBTI 집합 오버레이용 — Set: 복수 선택, empty = 상관없음(전체) */
  const [mbtiSet, setMbtiSet] = useState<Set<string>>(() => new Set());
  /** 혈액형 필터 — 복수 선택, empty = 상관없음 */
  const [bloodTypeSet, setBloodTypeSet] = useState<Set<string>>(() => new Set());
  /** 성별 인파 선호: all=전체, female_crowd=여성위주, male_crowd=남성위주 */
  const [genderPref, setGenderPref] = useState<'all' | 'female_crowd' | 'male_crowd'>('all');
  /** 활동 관심사 태그 */
  const [activityTags, setActivityTags] = useState<Set<string>>(() => new Set());
  /** 마이페이지에서 "다른 지역 알아보기" 선택 시 맵에 지역 픽 모드 트리거 */
  const [triggerExplorePick, setTriggerExplorePick] = useState(false);
  /** 현재 위치 모드: my_location(내 위치) | explore(다른 지역 탐색) */
  const [locationMode, setLocationMode] = useState<'my_location' | 'explore'>('my_location');

  const handleExploreArea = useCallback(() => {
    setLocationMode('explore');
    setTriggerExplorePick(true);
    setTab('map');
  }, []);

  const handleLocationModeChange = useCallback((mode: 'my_location' | 'explore') => {
    setLocationMode(mode);
    if (mode === 'explore') {
      setTriggerExplorePick(true);
      setTab('map');
    }
  }, []);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">

      {/* 헤더 바 — 스팟바이브 | 시간 | 탭 */}
      <div className="pointer-events-none absolute left-0 top-3 z-20 w-full px-4">
        <div className="pointer-events-auto flex items-center justify-between rounded-full border border-white/10 bg-[#1A1A24]/80 px-4 py-2.5 shadow-lg backdrop-blur-md">
          <h1 className="text-[17px] font-bold tracking-tight text-white leading-none">스팟바이브</h1>

          <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-semibold tabular-nums text-white/70 leading-none">
            {clock}
          </span>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-1.5 rounded-full border border-white/5 bg-black/40 px-3 py-1"
            >
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              <span className="text-[11px] font-medium text-white/90">{TAB_LABEL[tab]}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="relative flex h-full w-full flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            {tab === 'map' && (
              <div className="absolute inset-0">
                <MapArea
                  onClusterClick={() => setShowAIInsight(true)}
                  triggerExplorePick={triggerExplorePick}
                  onExplorePickConsumed={() => setTriggerExplorePick(false)}
                  onExplorePicked={() => setLocationMode('explore')}
                  mbtiSet={mbtiSet}
                  genderPref={genderPref}
                  activityTags={activityTags}
                />
              </div>
            )}
            {tab === 'events' && <EventsPage />}
            {tab === 'notifications' && <NotificationsPage />}
            {tab === 'my' && (
              <MyPage
                mobilityProfile={mobilityProfile}
                onMobilityProfileChange={setMobilityProfile}
                locationMode={locationMode}
                onLocationModeChange={handleLocationModeChange}
                mbtiSet={mbtiSet}
                onMbtiSetChange={setMbtiSet}
                bloodType={bloodTypeSet}
                onBloodTypeChange={setBloodTypeSet}
                genderPref={genderPref}
                onGenderPrefChange={setGenderPref}
                activityTags={activityTags}
                onActivityTagsChange={setActivityTags}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <NavigationBar active={tab} onChange={setTab} />

      <BottomSheet
        isOpen={showAIInsight && tab === 'map'}
        onClose={() => setShowAIInsight(false)}
        mobilityProfile={mobilityProfile}
      />
    </div>
  );
}

function AppRoutes() {
  const { isLoggedIn, login } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isLoggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLoginSuccess={login} />
          )
        }
      />
      <Route
        path="/"
        element={
          isLoggedIn ? (
            <SpotVibeMain />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="*"
        element={<Navigate to={isLoggedIn ? '/' : '/login'} replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="relative flex h-screen w-full flex-col items-center overflow-hidden bg-[#0A0A0E] font-sans text-white">
          <div className="relative flex h-full min-h-0 w-full max-w-[430px] flex-1 flex-col overflow-hidden shadow-2xl">
            <AppRoutes />
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
