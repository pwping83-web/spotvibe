/** 신규 발신 시 DB 기본 만료와 동일하게 유지 (마이그레이션 `interval '15 minutes'`) */
export const SOS_EXPIRE_MINUTES = 15;

/** SOS 신호 유형(4종) — 시민·이웃 도움 알림. 공식 응급기관을 대체하지 않습니다. */
export type SosSignalType = 'fire' | 'public_safety' | 'missing' | 'medical';

/** DB·Realtime에서 내려오는 행 */
export interface SosSignal {
  id: string;
  user_id: string;
  signal_type: string;
  lat: number;
  lng: number;
  status: 'active' | 'resolved' | 'expired';
  note: string | null;
  /** 공개 스토리지 URL — 있으면 피어 시트에서 확인 */
  photo_url?: string | null;
  /** Groq 비전 한 줄 요약(규모·상황) */
  ai_photo_summary?: string | null;
  responder_id: string | null;
  responded_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface SosTypeMeta {
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
}

const LEGACY_TO_NEW: Record<string, SosSignalType> = {
  fire_sighting: 'fire',
  safety_woman: 'public_safety',
  safety_conflict: 'public_safety',
  safety_threat: 'public_safety',
  tourist_help: 'missing',
  medical_immobile: 'medical',
  medical_diabetes: 'medical',
  medical_transport: 'medical',
};

export function normalizeSosSignalType(raw: string): SosSignalType {
  if (raw === 'fire' || raw === 'public_safety' || raw === 'missing' || raw === 'medical') {
    return raw;
  }
  return LEGACY_TO_NEW[raw] ?? 'public_safety';
}

export const SOS_TYPE_META: Record<SosSignalType, SosTypeMeta> = {
  fire: {
    label: '화재',
    sublabel: '연소·초기 진압',
    color: '#FF6600',
    bg: 'rgba(255,102,0,0.13)',
    border: 'rgba(255,102,0,0.45)',
    icon: '🔥',
  },
  public_safety: {
    label: '치안',
    sublabel: '위해·질서',
    color: '#5B8CFF',
    bg: 'rgba(91,140,255,0.12)',
    border: 'rgba(91,140,255,0.42)',
    icon: '🛡️',
  },
  missing: {
    label: '조난',
    sublabel: '실종·수색',
    color: '#00C9A7',
    bg: 'rgba(0,201,167,0.11)',
    border: 'rgba(0,201,167,0.38)',
    icon: '🧭',
  },
  medical: {
    label: '구급',
    sublabel: '의료 긴급',
    color: '#FF3344',
    bg: 'rgba(255,51,68,0.12)',
    border: 'rgba(255,51,68,0.45)',
    icon: '⛑️',
  },
};

export function getSosTypeMeta(signalType: string): SosTypeMeta {
  return SOS_TYPE_META[normalizeSosSignalType(signalType)];
}

/** 만료까지 남은 분(0이면 만료) */
export function sosMinutesLeft(expiresAt: string): number {
  const diff = (new Date(expiresAt).getTime() - Date.now()) / 60000;
  return Math.max(0, Math.round(diff));
}

/** 시간 경과에 따른 마커 투명도 (신선할수록 선명) */
export function sosOpacity(expiresAt: string, totalMinutes = SOS_EXPIRE_MINUTES): number {
  const left = sosMinutesLeft(expiresAt);
  return 0.35 + (left / totalMinutes) * 0.65;
}
