import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import { useProfileSync } from '@/hooks/useProfileSync';
import { useViNeighborHelpMessages } from '@/hooks/useViNeighborHelpMessages';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useActiveLocationLoadScale } from '@/hooks/useActiveLocationLoadScale';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { MapArea } from './components/MapArea';
import { BottomSheet } from './components/BottomSheet';
import { NavigationBar, TabKey } from './components/NavigationBar';
import { EventsPage } from './components/EventsPage';
import { NotificationsPage } from './components/NotificationsPage';
import { MyPage, type AgeRange, type Gender, type MobilityProfile } from './components/MyPage';
import { LoginPage } from './components/LoginPage';
import { PrivacyPage } from './components/PrivacyPage';
import { TermsPage } from './components/TermsPage';
import { CompanyInfoPage } from './components/CompanyInfoPage';
import { ServiceIntroPage } from './components/ServiceIntroPage';
import { ReviewFlowTocPage } from './components/ReviewFlowTocPage';
import { SignupPage } from './components/SignupPage';
import { Toaster, toast } from 'sonner';
import {
  DEFAULT_EXPLORE_CENTER,
  EXPLORE_REGION_PRESETS,
  type ExploreRegionPreset,
} from './constants/exploreRegions';
import type { AiInsightProfilePayload } from '@/lib/groqAiInsights';
import {
  readInitialDataMode,
  readAdminMapTestPreview,
  persistAdminMapTestPreview,
  type SpotVibeDataMode,
} from './constants/dataMode';
import { usePhoneLandscapeMapMinimal } from '@/hooks/usePhoneLandscapeMapMinimal';
import { useMatchedUsers } from '@/hooks/useMatchedUsers';
import { useModerationEnforcement } from '@/hooks/useModerationEnforcement';
import { useSosSignals } from '@/hooks/useSosSignals';
import { SosSignalSheet } from './components/SosSignalSheet';
import { SosActiveFullscreenOverlay } from './components/SosActiveFullscreenOverlay';
import { SosPeerSignalSheet } from './components/SosPeerSignalSheet';
import { SosReviewsPage } from './components/SosReviewsPage';
import { AdminSosModerationPage } from './components/AdminSosModerationPage';
import type { SosSignal, SosSignalType } from '@/types/sos';
import { SOS_SEND_ERROR_KO } from '@/lib/edgeFunctionKorean';
import {
  buildNearbyFireTestSosSignal,
  isSosTestSimSignal,
  SOS_TEST_NEARBY_FIRE_ID,
} from '@/lib/sosTestSim';

/** `profiles.notification_time_slots` — MyPage TIME_SLOTS.id 와 동일 */
const NOTIFICATION_TIME_SLOT_IDS = new Set(['lunch', 'afternoon', 'evening', 'late']);

const PROFILE_MOBILITY_IDS = new Set<MobilityProfile>(['car_owner', 'kickboard_license', 'pedestrian_ddareungi']);
const PROFILE_AGE_KEYS = new Set<AgeRange>(['10대', '20대', '30대', '40대', '50대', '60대+']);
const PROFILE_GENDER_KEYS = new Set<Gender>(['남성', '여성']);

function isValidProfileLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function defaultNotificationWeekdays() {
  return new Set<number>([0, 2, 4]);
}
function defaultNotificationTimeSlots() {
  return new Set<string>(['evening']);
}

const TAB_LABEL: Record<TabKey, string> = {
  map: '지도',
  events: '이벤트',
  notifications: '알림',
  my: '마이',
};

type AuthContextValue = {
  isLoggedIn: boolean;
  userId: string | null;
  userEmail: string | null;
  /** 첫 `getSession()` 완료 전 — OAuth 복귀 URL의 해시/코드가 날아가지 않게 `/`에서 로그인으로 보내지 않음 */
  authReady: boolean;
  /** Supabase OAuth 성공 후 호출 (현재는 카카오 버튼 플로우에서 직접 호출) */
  login: () => void;
  logout: () => void;
  /** `profiles` 행 삭제 후 세션 종료 (RLS에서 본인 삭제 허용 필요) */
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** OAuth 리다이렉트 직후 URL에 토큰/code가 있으면 getSession 직후 라우팅하면 해시가 날아갈 수 있음 → 잠깐 대기 */
function urlLooksLikeOAuthReturn(): boolean {
  const { hash, search } = window.location;
  return (
    hash.includes('access_token') ||
    hash.includes('refresh_token') ||
    hash.includes('code=') ||
    search.includes('code=')
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAuthReady = (session: { user: { id: string; email?: string } } | null) => {
      if (cancelled) return;
      // OAuth 직후 URL에 code/hash만 있고 세션 아직 없으면 교환 완료까지 잠깐 대기
      const delay = urlLooksLikeOAuthReturn() && !session ? 280 : 0;
      readyTimer = window.setTimeout(() => {
        if (!cancelled) setAuthReady(true);
      }, delay);
    };

    void sb.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) {
          setIsLoggedIn(!!session);
          setUserId(session?.user.id ?? null);
          setUserEmail(session?.user.email ?? null);
        }
        scheduleAuthReady(session);
      })
      .catch(() => {
        if (!cancelled) {
          readyTimer = window.setTimeout(() => {
            if (!cancelled) setAuthReady(true);
          }, 0);
        }
      });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      setUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? null);
    });

    return () => {
      cancelled = true;
      if (readyTimer) clearTimeout(readyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(() => {
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    void (async () => {
      const sb = getSupabase();
      if (sb) await sb.auth.signOut();
      setIsLoggedIn(false);
      setUserId(null);
      setUserEmail(null);
    })();
  }, []);

  const deleteAccount = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      toast.error('Supabase가 설정되지 않아 탈퇴를 진행할 수 없어요.');
      return;
    }
    const {
      data: { session },
    } = await sb.auth.getSession();
    const uid = session?.user.id;
    if (!uid) {
      toast.error('로그인이 필요해요.');
      return;
    }
    const { error } = await sb.from('profiles').delete().eq('id', uid);
    if (error) {
      toast.error('탈퇴 처리 중 오류가 났어요.', { description: error.message });
      return;
    }
    await sb.auth.signOut();
    setIsLoggedIn(false);
    setUserId(null);
    toast.success('저장된 프로필이 삭제되었고 로그아웃되었어요.');
  }, []);

  const value = useMemo(
    () => ({ isLoggedIn, userId, userEmail, authReady, login, logout, deleteAccount }),
    [isLoggedIn, userId, userEmail, authReady, login, logout, deleteAccount],
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
function AdminSosModerationRoute() {
  const { userEmail, authReady } = useAuth();
  if (!authReady) return <AuthBootSplash />;
  if ((userEmail ?? '').toLowerCase() !== 'pwping83@gmail.com') {
    return <Navigate to="/" replace />;
  }
  return <AdminSosModerationPage />;
}

function SpotVibeMain() {
  const clock = useLiveClock();
  const { userId, userEmail, logout, deleteAccount } = useAuth();
  useModerationEnforcement(userId);
  const isAdmin = userEmail === 'pwping83@gmail.com';
  const [showAIInsight, setShowAIInsight] = useState(false);
  /** 지도「위치 변경」찍기 → 경로 보기 시 BottomSheet 목적지 오버라이드 */
  const [routeSheetDest, setRouteSheetDest] = useState<{ query: string; label: string } | null>(null);
  const [tab, setTab] = useState<TabKey>('map');
  const phoneLandscapeMapMinimal = usePhoneLandscapeMapMinimal();
  const mapMinimalLayout = phoneLandscapeMapMinimal && tab === 'map';
  const [mobilityProfile, setMobilityProfile] = useState<MobilityProfile>(
    'pedestrian_ddareungi',
  );
  /** 마이「선호 활동 시간」— Supabase notification_weekdays / notification_time_slots */
  const [notificationWeekdaySet, setNotificationWeekdaySet] = useState<Set<number>>(defaultNotificationWeekdays);
  const [notificationTimeSlotSet, setNotificationTimeSlotSet] = useState<Set<string>>(defaultNotificationTimeSlots);
  const [aiNotificationsPaused, setAiNotificationsPaused] = useState(false);
  /** 서버에서 요일·시간대 로드 완료 전에는 알림 컬럼을 upsert에 실지 않음 */
  const [notificationScheduleHydrated, setNotificationScheduleHydrated] = useState(false);
  /** 서버에서 마이 프로필 로드 전에는 useProfileSync upsert 금지(DB 덮어쓰기 방지) */
  const [mainProfileHydrated, setMainProfileHydrated] = useState(false);
  /** 마이 — 이웃 도움 메시지(시각장애인 음성 수신) */
  const [viNeighborTipsOptIn, setViNeighborTipsOptIn] = useState(false);
  /** 탐색 지도 중심 — 마이에서 확정하거나 지도에서 바꿀 때 갱신 */
  const [exploreAnchor, setExploreAnchor] = useState<[number, number]>(DEFAULT_EXPLORE_CENTER);
  const [exploreJumpSeq, setExploreJumpSeq] = useState(0);
  /** 현재 위치 모드: my_location(내 위치) | explore(다른 지역 탐색) */
  const [locationMode, setLocationMode] = useState<'my_location' | 'explore'>('my_location');
  /** 지도에서 「내 위치 찾기」실시간 추적(또는 관리자 테스트 지도) 켠 동안만 내 좌표 DB 반영 */
  const [mapLocationShareActive, setMapLocationShareActive] = useState(false);
  /** 프로필 연령·성별 — 마이 표시·AI 인사이트 참고용 */
  const [profileAgeRange, setProfileAgeRange] = useState<AgeRange>('30대');
  const [profileGender, setProfileGender] = useState<Gender>('남성');

  /** 예전 `spotvibe:dataMode=test` 저장값을 `real`로 정리 */
  useEffect(() => {
    readInitialDataMode();
  }, []);

  /** 관리자만: 지도 가상 인구·데모 미리보기 (로컬·본인 세션만) */
  const [adminMapTestPreview, setAdminMapTestPreview] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setAdminMapTestPreview(false);
      return;
    }
    setAdminMapTestPreview(readAdminMapTestPreview());
  }, [isAdmin]);

  const commitAdminMapTestPreview = useCallback((on: boolean) => {
    if (!isAdmin) return;
    setAdminMapTestPreview(on);
    persistAdminMapTestPreview(on);
  }, [isAdmin]);

  const mapDataMode: SpotVibeDataMode = isAdmin && adminMapTestPreview ? 'test' : 'real';
  const mapServerEnabled =
    mapDataMode === 'real' &&
    !(isAdmin && adminMapTestPreview);

  const aiInsightProfilePayload = useMemo(
    (): AiInsightProfilePayload => ({
      ageRange: profileAgeRange,
      gender: profileGender,
      mbti: [],
      bloodTypes: [],
      activityTags: [],
      genderPref: 'all',
      ageRangeMatchSet: [],
      notificationTimeSlots: Array.from(notificationTimeSlotSet).sort(),
      notificationWeekdays: Array.from(notificationWeekdaySet).sort((a, b) => a - b),
    }),
    [profileAgeRange, profileGender, notificationTimeSlotSet, notificationWeekdaySet],
  );

  const [gamification, setGamification] = useState<{
    points: number | null;
  }>({ points: null });

  const loadGamification = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !userId) {
      setGamification({ points: null });
      return;
    }
    const { data } = await sb
      .from('profiles')
      .select('contribution_points')
      .eq('id', userId)
      .single();
    setGamification({
      points: data?.contribution_points ?? 0,
    });
  }, [userId]);

  useEffect(() => {
    void loadGamification();
  }, [loadGamification]);

  useEffect(() => {
    if (tab === 'my' && userId) void loadGamification();
  }, [tab, userId, loadGamification]);

  /** 프로필에서 마이·알림 일괄 로드 */
  useEffect(() => {
    if (!userId) {
      setNotificationWeekdaySet(defaultNotificationWeekdays());
      setNotificationTimeSlotSet(defaultNotificationTimeSlots());
      setAiNotificationsPaused(false);
      setNotificationScheduleHydrated(false);
      setMainProfileHydrated(false);
      setViNeighborTipsOptIn(false);
      return;
    }
    let cancelled = false;
    setNotificationScheduleHydrated(false);
    setMainProfileHydrated(false);
    (async () => {
      try {
        const sb = getSupabase();
        if (!sb || cancelled) return;
        const { data } = await sb
          .from('profiles')
          .select(
            'notification_weekdays, notification_time_slots, ai_notifications_paused, mobility_profile, location_mode, explore_lat, explore_lng, age_range, gender, vi_neighbor_tips_opt_in',
          )
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          const wd = data.notification_weekdays;
          if (Array.isArray(wd) && wd.length > 0) {
            const nums = wd.filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 6);
            if (nums.length > 0) setNotificationWeekdaySet(new Set(nums));
            else setNotificationWeekdaySet(defaultNotificationWeekdays());
          } else {
            setNotificationWeekdaySet(defaultNotificationWeekdays());
          }
          const ts = data.notification_time_slots;
          if (Array.isArray(ts) && ts.length > 0) {
            const ok = ts.filter(
              (s): s is string => typeof s === 'string' && NOTIFICATION_TIME_SLOT_IDS.has(s),
            );
            setNotificationTimeSlotSet(
              new Set(ok.length > 0 ? ok : Array.from(defaultNotificationTimeSlots())),
            );
          } else {
            setNotificationTimeSlotSet(defaultNotificationTimeSlots());
          }
          setAiNotificationsPaused(Boolean(data.ai_notifications_paused));

          const mob = data.mobility_profile;
          if (typeof mob === 'string' && PROFILE_MOBILITY_IDS.has(mob as MobilityProfile)) {
            setMobilityProfile(mob as MobilityProfile);
          }
          const lm = data.location_mode;
          setLocationMode(lm === 'explore' ? 'explore' : 'my_location');
          if (isValidProfileLatLng(data.explore_lat, data.explore_lng)) {
            setExploreAnchor([data.explore_lat as number, data.explore_lng as number]);
          }
          const ar = data.age_range;
          if (typeof ar === 'string' && PROFILE_AGE_KEYS.has(ar as AgeRange)) {
            setProfileAgeRange(ar as AgeRange);
          }
          const gen = data.gender;
          if (typeof gen === 'string' && PROFILE_GENDER_KEYS.has(gen as Gender)) {
            setProfileGender(gen as Gender);
          }
          setViNeighborTipsOptIn(Boolean(data.vi_neighbor_tips_opt_in));
        } else {
          setNotificationWeekdaySet(defaultNotificationWeekdays());
          setNotificationTimeSlotSet(defaultNotificationTimeSlots());
          setAiNotificationsPaused(false);
          setViNeighborTipsOptIn(false);
        }
      } finally {
        if (!cancelled) {
          setNotificationScheduleHydrated(true);
          setMainProfileHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const emptyTagSet = useMemo(() => new Set<string>(), []);
  const [documentVisible, setDocumentVisible] = useState(() => document.visibilityState === 'visible');

  useEffect(() => {
    const onVisibility = () => setDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const mapRuntimeActive = tab === 'map' && documentVisible;

  useEffect(() => {
    if (!userId) setMapLocationShareActive(false);
  }, [userId]);

  const handleMapLocationShareActiveChange = useCallback(
    async (active: boolean) => {
      setMapLocationShareActive(active);
      if (active) return;
      const sb = getSupabase();
      if (!sb || !userId) return;
      const { error } = await sb
        .from('profiles')
        .update({ explore_lat: null, explore_lng: null })
        .eq('id', userId);
      if (error) console.warn('[SpotVibe] 위치 공유 끔: profiles 좌표 비우기', error.message);
    },
    [userId],
  );

  const { writeIntervalMs, refetchIntervalMs } = useActiveLocationLoadScale(!!userId && mapRuntimeActive);

  /** watchPosition + 주기 DB 동기화로 위치 공유 — 지도에서 켠 경우에만 */
  const { lastKnown } = useLocationTracking({
    userId,
    locationMode,
    enabled:
      !!userId &&
      mapRuntimeActive &&
      mapLocationShareActive &&
      mapServerEnabled &&
      locationMode === 'my_location',
    adminMapTestVirtual: isAdmin && adminMapTestPreview,
    writeIntervalMs,
  });

  /** 근처 다른 사용자 — 위치 공유 켠 실서비스에서만 (제출용으로 비워 두던 로직 복구) */
  const nearbyQueryCenter = useMemo((): [number, number] => {
    if (locationMode === 'my_location' && lastKnown) return lastKnown;
    return exploreAnchor;
  }, [locationMode, lastKnown, exploreAnchor]);

  const matchedUsers = useMatchedUsers({
    center: nearbyQueryCenter,
    radiusKm: 15,
    activityTags: emptyTagSet,
    mbtiSet: emptyTagSet,
    bloodTypeSet: emptyTagSet,
    genderPref: 'all',
    ageRangeSet: emptyTagSet,
    myUserId: userId,
    enabled:
      !!userId &&
      mapRuntimeActive &&
      mapLocationShareActive &&
      mapServerEnabled,
    onlyLiveLocationMode: locationMode === 'my_location',
    refetchIntervalMs,
  });

  /** 마이페이지 설정 → Supabase 자동 저장. `내 위치`일 때는 explore 좌표를 upsert에 넣지 않음 — GPS 전용(useLocationTracking)과 충돌 방지 */
  useProfileSync({
    userId: mapServerEnabled ? userId : null,
    mobilityProfile,
    mbtiTypes: [],
    bloodTypes: [],
    genderCrowdPref: 'all',
    activityTags: [],
    locationMode,
    ageRange: profileAgeRange,
    gender: profileGender,
    exploreLat: locationMode === 'explore' ? exploreAnchor[0] : undefined,
    exploreLng: locationMode === 'explore' ? exploreAnchor[1] : undefined,
    notificationWeekdays: Array.from(notificationWeekdaySet).sort((a, b) => a - b),
    notificationTimeSlots: Array.from(notificationTimeSlotSet).sort(),
    aiNotificationsPaused,
    profileHydrated: notificationScheduleHydrated,
    mainProfileHydrated,
    viNeighborTipsOptIn,
  });

  useViNeighborHelpMessages({
    userId,
    optIn: viNeighborTipsOptIn,
    serverEnabled: mapServerEnabled,
  });

  const commitExploreAnchor = useCallback((c: [number, number]) => {
    setExploreAnchor(c);
  }, []);

  // ─── SOS 도움 신호 ───
  const [sosSheetOpen, setSosSheetOpen] = useState(false);
  const [sosPeerSignal, setSosPeerSignal] = useState<SosSignal | null>(null);

  /** 지도가 알려 주는 내 좌표(브라우저 GPS·10분 홀드). DB lastKnown보다 우선해 SOS와 맞춤 */
  const [mapClientMyLocation, setMapClientMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  const sosCenter = useMemo((): [number, number] | null => {
    if (locationMode === 'explore') return exploreAnchor;
    if (mapClientMyLocation) return [mapClientMyLocation.lat, mapClientMyLocation.lng];
    if (lastKnown) return lastKnown;
    return null;
  }, [locationMode, exploreAnchor, mapClientMyLocation, lastKnown]);

  const {
    signals: sosSignals,
    myActiveSignalId,
    sosDailyLimitReached,
    refreshSosDailyQuota,
    sendSignal,
    resolveMySignal,
    respondToSignal,
  } = useSosSignals({
    center: sosCenter,
    myUserId: userId,
    enabled:
      !!userId &&
      mapRuntimeActive &&
      mapServerEnabled,
    isAdmin,
  });

  /** 관리자 테스트 지도: 서버 SOS 비활성 시에도 근처 화재 마커만 클라이언트로 병합 */
  const sosSignalsForMap = useMemo(() => {
    if (!isAdmin || !adminMapTestPreview || !sosCenter) return sosSignals;
    const sim = buildNearbyFireTestSosSignal(sosCenter);
    const rest = sosSignals.filter((s) => s.id !== SOS_TEST_NEARBY_FIRE_ID);
    return [...rest, sim];
  }, [isAdmin, adminMapTestPreview, sosCenter, sosSignals]);

  useEffect(() => {
    if (sosSheetOpen && userId) void refreshSosDailyQuota();
  }, [sosSheetOpen, userId, refreshSosDailyQuota]);

  // SOS 활성 중 진동 + 브라우저 알림 — 45초 주기 진동, 2분 주기 알림
  useEffect(() => {
    if (!myActiveSignalId) return;

    // 알림 권한 요청 (첫 활성화 시 1회)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const sendReminder = () => {
      // 진동: 300ms 3회 연타
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 150, 300, 150, 300]);
      }
    };

    const sendNotification = () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🆘 SpotVibe — SOS 신호 발신 중', {
          body: '신호가 아직 켜져 있어요. 상황이 해결됐다면 앱에서 신호를 해제해 주세요.',
          icon: '/favicon.png',
          tag: 'sos-active-reminder',
          renotify: true,
        });
      }
    };

    // 최초 즉시 진동 1회
    sendReminder();

    const vibeInterval = setInterval(sendReminder, 45_000);
    const notifInterval = setInterval(sendNotification, 120_000);

    return () => {
      clearInterval(vibeInterval);
      clearInterval(notifInterval);
    };
  }, [myActiveSignalId]);

  const handleSosSend = useCallback(
    async (type: SosSignalType, note: string, photo?: File | null) => {
      if (!sosCenter) {
        toast.error('위치를 확인할 수 없어요. 지도에서 「내 위치 찾기」를 켜 주세요.');
        throw new Error('no_sos_center');
      }
      const result = await sendSignal({
        signalType: type,
        lat: sosCenter[0],
        lng: sosCenter[1],
        note,
        photoFile: photo ?? undefined,
      });
      if ('error' in result) {
        if (result.error === 'sos_daily_limit') {
          toast.error(
            '오늘은 이미 SOS를 보냈어요. 한국 시간 기준 내일 자정 이후에 다시 보낼 수 있어요. 이웃을 위해 꼭 필요할 때만 소중하게 써 주세요.',
          );
        } else if (result.error === 'sos_photo_integrity_failed') {
          toast.error(
            result.reason ??
              '촬영 시각이 맞지 않거나 스크린샷으로 보여요. 방금 찍은 카메라 원본만 올려 주세요.',
          );
        } else if (result.error === 'sos_photo_rejected') {
          toast.error(result.reason ?? '사진이 선택한 신고 유형과 맞지 않아요. 현장에 맞는 사진을 올려 주세요.');
        } else if (result.error === 'sos_note_blocked') {
          toast.error(
            result.reason ?? '메모에 부적절한 내용이 포함된 것으로 판단됐어요. 홍보·음란·범죄 관련 문구는 수정해 주세요.',
          );
        } else if (
          result.error === 'sos_photo_verify_failed' ||
          result.error === 'photo_upload_failed' ||
          result.error === 'photo_compress_failed'
        ) {
          toast.error(result.reason ?? '사진 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
        } else {
          const fallbackMsg =
            SOS_SEND_ERROR_KO[result.error] ?? '신호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.';
          const reason =
            typeof (result as { reason?: unknown }).reason === 'string'
              ? ((result as { reason?: string }).reason ?? '').trim()
              : '';
          toast.error(reason || fallbackMsg);
        }
        throw new Error(result.error);
      }
    },
    [sosCenter, sendSignal],
  );

  const handleSosResolve = useCallback(async () => {
    const result = await resolveMySignal();
    if (result?.error) {
      if (result.error === 'no_active_signal') {
        toast.error('활성 신호가 없습니다. 이미 해제됐거나 만료됐을 수 있어요.');
      } else {
        toast.error('신호 해제 실패: ' + result.error);
      }
      throw new Error(result.error);
    }
  }, [resolveMySignal]);

  const handleSosPeerRespond = useCallback(
    async (signalId: string) => respondToSignal(signalId),
    [respondToSignal],
  );

  const handleApplyExploreFromMy = useCallback((preset: ExploreRegionPreset) => {
    setExploreAnchor(preset.center);
    setExploreJumpSeq((n) => n + 1);
    setLocationMode('explore');
    setTab('map');
  }, []);

  const handleLocationModeChange = useCallback((mode: 'my_location' | 'explore') => {
    setLocationMode(mode);
  }, []);

  /** 지도 탭으로 돌아올 때 Leaflet 타일 레이아웃 보정(숨겨 두었다가 다시 보일 때) */
  useEffect(() => {
    if (tab !== 'map') return;
    const id = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(id);
  }, [tab]);

  /** 휴대폰 가로(지도만 모드) 전환 시 지도 영역 크기 재계산 */
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(id);
  }, [mapMinimalLayout]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">

      {/* 헤더 바 — 지금 여기 | 시간 | 탭 */}
      <div
        className={`pointer-events-none absolute left-0 top-3 z-20 w-full px-6 ${mapMinimalLayout ? 'hidden' : ''}`}
      >
        <div className="pointer-events-auto flex items-center justify-between rounded-full border border-white/10 bg-[#1A1A24]/80 px-6 py-2.5 shadow-lg backdrop-blur-md">
          <h1 className="text-[17px] font-bold tracking-tight text-white leading-none pl-0.5">지금 여기</h1>

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
        {/* 지도는 탭 전환 시에도 마운트 유지 → 실시간 GPS 추적·지도 내부 상태가 풀리지 않음 */}
        <div
          className="absolute inset-0 z-0"
          style={{
            visibility: tab === 'map' ? 'visible' : 'hidden',
            pointerEvents: tab === 'map' ? 'auto' : 'none',
          }}
          aria-hidden={tab !== 'map'}
        >
          <div className="absolute inset-0 h-full min-h-0 w-full">
            <MapArea
              onClusterClick={() => {
                setRouteSheetDest(null);
                setShowAIInsight(true);
              }}
              onExplorePicked={() => setLocationMode('explore')}
              onOpenRouteSheetTo={(naverQuery, displayLabel) => {
                setRouteSheetDest({ query: naverQuery, label: displayLabel });
                setShowAIInsight(true);
              }}
              dataMode={mapDataMode}
              profileAgeRange={profileAgeRange}
              mbtiSet={emptyTagSet}
              bloodTypeSet={emptyTagSet}
              genderPref="all"
              activityTags={emptyTagSet}
              exploreAnchor={exploreAnchor}
              exploreJumpSeq={exploreJumpSeq}
              onExploreAnchorCommit={commitExploreAnchor}
              matchedUsers={matchedUsers}
              onReportSubmitted={loadGamification}
              livePhotoFeedEnabled={!!userId}
              isAdmin={isAdmin}
              onMapLocationShareActiveChange={handleMapLocationShareActiveChange}
              onMapClientMyLocationChange={setMapClientMyLocation}
              isActive={mapRuntimeActive}
              locationMode={locationMode}
              mapMinimalChrome={mapMinimalLayout}
              sosSignals={sosSignalsForMap}
              myActiveSosSignalId={myActiveSignalId}
              onSosOpen={() => {
                setSosPeerSignal(null);
                setSosSheetOpen(true);
              }}
              onSosPeerSelect={(sig) => {
                if (isSosTestSimSignal(sig)) {
                  toast.info('[테스트] 근처 화재 시뮬 마커예요. 실제 신호가 아니라 이웃 시트는 열리지 않아요.');
                  return;
                }
                setSosSheetOpen(false);
                setSosPeerSignal(sig);
              }}
              userId={userId}
              mapServerEnabled={mapServerEnabled}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {tab !== 'map' && (
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="absolute inset-0 z-10 flex min-h-0 flex-col bg-[#0A0A0E]"
            >
              {tab === 'events' && <EventsPage />}
              {tab === 'notifications' && (
                <NotificationsPage
                  exploreAnchor={exploreAnchor}
                  aiNotificationsPaused={aiNotificationsPaused}
                  aiProfile={aiInsightProfilePayload}
                />
              )}
              {tab === 'my' && (
                <MyPage
                  isAdmin={isAdmin}
                  ageRange={profileAgeRange}
                  onAgeRangeChange={setProfileAgeRange}
                  gender={profileGender}
                  onGenderChange={setProfileGender}
                  mobilityProfile={mobilityProfile}
                  onMobilityProfileChange={setMobilityProfile}
                  locationMode={locationMode}
                  onLocationModeChange={handleLocationModeChange}
                  notificationWeekdays={notificationWeekdaySet}
                  onNotificationWeekdaysChange={setNotificationWeekdaySet}
                  notificationTimeSlots={notificationTimeSlotSet}
                  onNotificationTimeSlotsChange={setNotificationTimeSlotSet}
                  aiNotificationsPaused={aiNotificationsPaused}
                  onAiNotificationsPausedChange={setAiNotificationsPaused}
                  gamificationPoints={gamification.points}
                  onGamificationRefetch={loadGamification}
                  onLogout={logout}
                  onDeleteAccount={deleteAccount}
                  explorePresets={EXPLORE_REGION_PRESETS}
                  onApplyExploreRegion={handleApplyExploreFromMy}
                  exploreAnchor={exploreAnchor}
                  adminMapTestPreview={adminMapTestPreview}
                  onAdminMapTestPreviewChange={commitAdminMapTestPreview}
                  viNeighborTipsOptIn={viNeighborTipsOptIn}
                  onViNeighborTipsOptInChange={setViNeighborTipsOptIn}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!mapMinimalLayout && <NavigationBar active={tab} onChange={setTab} />}

      <BottomSheet
        isOpen={showAIInsight && tab === 'map'}
        onClose={() => {
          setShowAIInsight(false);
          setRouteSheetDest(null);
        }}
        mobilityProfile={mobilityProfile}
        destinationQuery={routeSheetDest?.query ?? null}
        destinationLabel={routeSheetDest?.label ?? null}
      />

      <SosSignalSheet
        open={sosSheetOpen}
        onClose={() => setSosSheetOpen(false)}
        myLocation={sosCenter ? { lat: sosCenter[0], lng: sosCenter[1] } : null}
        myActiveSignalId={myActiveSignalId}
        dailyQuotaExceeded={sosDailyLimitReached && !myActiveSignalId}
        onSend={handleSosSend}
      />

      {myActiveSignalId && userId ? (
        <SosActiveFullscreenOverlay onEndSignal={handleSosResolve} />
      ) : null}

      <SosPeerSignalSheet
        open={!!sosPeerSignal}
        signal={sosPeerSignal}
        myUserId={userId}
        onClose={() => setSosPeerSignal(null)}
        onRespond={handleSosPeerRespond}
      />
    </div>
  );
}

function AuthBootSplash() {
  return (
    <div className="flex h-full min-h-[50vh] w-full flex-col items-center justify-center gap-3 bg-[#0A0A0E] px-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#00F0FF]" aria-hidden />
      <p className="text-[14px] font-semibold text-white/75">로그인 정보 확인 중…</p>
      <p className="text-[12px] text-white/40">카카오 로그인 직후라면 잠시만 기다려 주세요</p>
    </div>
  );
}

function AppRoutes() {
  const { isLoggedIn, login, authReady } = useAuth();

  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/company" element={<CompanyInfoPage />} />
      <Route path="/service" element={<ServiceIntroPage />} />
      <Route path="/review-flow" element={<ReviewFlowTocPage />} />
      <Route
        path="/signup"
        element={
          !authReady ? (
            <AuthBootSplash />
          ) : isLoggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <SignupPage onLoginSuccess={login} />
          )
        }
      />
      <Route
        path="/login"
        element={
          !authReady ? (
            <AuthBootSplash />
          ) : isLoggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLoginSuccess={login} />
          )
        }
      />
      <Route
        path="/"
        element={
          !authReady ? (
            <AuthBootSplash />
          ) : isLoggedIn ? (
            <SpotVibeMain />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/sos-reviews"
        element={
          !authReady ? (
            <AuthBootSplash />
          ) : isLoggedIn ? (
            <SosReviewsPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin/sos-moderation"
        element={
          !authReady ? (
            <AuthBootSplash />
          ) : isLoggedIn ? (
            <AdminSosModerationRoute />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="*"
        element={
          !authReady ? (
            <AuthBootSplash />
          ) : (
            <Navigate to={isLoggedIn ? '/' : '/login'} replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* 폰 컬럼은 flex-col 직계 자식에 mx-auto 두지 않음(가로가 콘텐츠 폭으로 수축되는 브라우저 다수). 가로 정렬은 justify-center 행에서 처리 */}
        <div className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#0A0A0E] font-sans text-white">
          <div className="flex min-h-0 flex-1 w-full min-w-0 justify-center overflow-hidden">
            <div className="relative flex h-full min-h-0 w-full max-w-[430px] shrink-0 flex-col overflow-hidden shadow-2xl [@media(orientation:landscape)_and_(max-height:480px)_and_(max-width:960px)]:max-w-none">
              <AppRoutes />
            </div>
          </div>
        </div>
        <Toaster
          className="!z-[10000]"
          theme="dark"
          position="top-center"
          richColors
          closeButton
          /* pure #000 토스트는 앱 배경(#0A0A0E)과 구분이 약하고 본문이 답답해 보일 수 있음 */
          style={
            {
              '--normal-bg': '#16161d',
              '--normal-border': 'rgba(255, 255, 255, 0.12)',
              '--normal-text': '#f4f4f5',
              '--normal-bg-hover': '#1d1d27',
              '--normal-border-hover': 'rgba(255, 255, 255, 0.18)',
            } as React.CSSProperties
          }
          toastOptions={{
            classNames: {
              title: '!text-[#f4f4f5]',
              /* sonner 기본 [data-description] 색보다 우선해 가독성 확보 */
              description: '!text-[#d4d4d8] !leading-snug',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
