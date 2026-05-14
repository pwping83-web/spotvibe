import { useEffect, useRef } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

const DEBOUNCE_MS = 1200;

export interface ProfileFields {
  userId: string | null;
  mobilityProfile: string;
  mbtiTypes: string[];
  bloodTypes: string[];
  genderCrowdPref: string;
  activityTags: string[];
  locationMode: string;
  exploreLat?: number | null;
  exploreLng?: number | null;
  ageRange?: string;
  gender?: string;
  notificationWeekdays?: number[];
  notificationTimeSlots?: string[];
  aiNotificationsPaused?: boolean;
  /** false면 아직 서버에서 일정을 읽기 전 — 알림 필드는 upsert에 넣지 않음(기본값 덮어쓰기 방지) */
  profileHydrated?: boolean;
  /** false면 아직 서버에서 마이 프로필을 읽기 전 — upsert 안 함(첫 렌더 기본값이 DB를 덮는 것 방지) */
  mainProfileHydrated?: boolean;
  /** 시각장애인 이웃 도움 메시지 수신(Supabase realtime + 음성) */
  viNeighborTipsOptIn?: boolean;
}

/** 프로필 필드가 바뀔 때마다 1.2초 debounce 후 Supabase upsert */
export function useProfileSync(fields: ProfileFields) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = useRef<string>('');

  useEffect(() => {
    if (!fields.userId) return;
    if (fields.mainProfileHydrated === false) return;

    const serialized = JSON.stringify(fields);
    if (serialized === prevRef.current) return;
    prevRef.current = serialized;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const sb = getSupabase();
      if (!sb || !fields.userId) return;

      const row: Record<string, unknown> = {
        id: fields.userId,
        mobility_profile: fields.mobilityProfile,
        mbti_types: fields.mbtiTypes,
        blood_types: fields.bloodTypes,
        gender_crowd_pref: fields.genderCrowdPref,
        activity_tags: fields.activityTags,
        location_mode: fields.locationMode,
      };

      if (fields.exploreLat !== undefined) row.explore_lat = fields.exploreLat;
      if (fields.exploreLng !== undefined) row.explore_lng = fields.exploreLng;
      if (fields.ageRange !== undefined) row.age_range = fields.ageRange;
      if (fields.gender !== undefined) row.gender = fields.gender;
      const pushNotifications = fields.profileHydrated !== false;
      if (pushNotifications && fields.notificationWeekdays !== undefined)
        row.notification_weekdays = fields.notificationWeekdays;
      if (pushNotifications && fields.notificationTimeSlots !== undefined)
        row.notification_time_slots = fields.notificationTimeSlots;
      if (pushNotifications && fields.aiNotificationsPaused !== undefined)
        row.ai_notifications_paused = fields.aiNotificationsPaused;
      if (fields.viNeighborTipsOptIn !== undefined)
        row.vi_neighbor_tips_opt_in = fields.viNeighborTipsOptIn;

      const { error } = await sb.from('profiles').upsert(row, { onConflict: 'id' });
      if (error) console.warn('[useProfileSync] profiles upsert:', error.message, error);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fields]);
}
