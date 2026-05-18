import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  X,
  Upload,
  MapPin,
  CheckCircle,
  AlertCircle,
  Pencil,
  MessageSquare,
  ImagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabaseClient';
import { isSpotReportTextBlocked } from '@/lib/spotReportModeration';
import { useAuth } from '@/app/App';
import { buildFaceMosaicDataUrl, FaceMosaicImage } from './FaceMosaicImage';
import {
  isCoarsePointerDevice,
  setSpotReportSheetSessionOpen,
  spotReportSheetSessionOpen,
  getSpotReportDraft,
  setSpotReportDraft,
  clearSpotReportSheetDraft,
} from '@/lib/spotReportSheetSession';
import { PHOTO_CATEGORIES } from '@/lib/photoCategories';

const SPOTVIBE_ADMIN_AI_LS = 'spotvibe_admin_ai_spot_verify';

/**
 * ━━ 업로드 제약 테스트 스위치 ━━
 *
 * [1단계] SKIP_SPOT_AI_VERIFY = true  ← 현재
 *   - 제목 AI(moderate-user-content) 미호출
 *   - 관리자 사진 AI(ai-verify-spot-report) 미호출
 *
 * [2단계] SKIP_AUTOVERIFY_RPC = true  ← 현재
 *   - autoverify_own_spot_report RPC 미호출
 *   - insert 시 status = 'verified' 로 직접 저장
 *
 * 복구: 각각 false 로 변경
 */
const SKIP_SPOT_AI_VERIFY = false;
// ↑ [1단계 끄기] true 로 바꾸면 AI 텍스트·비전 검증 건너뜀(테스트용)

const SKIP_AUTOVERIFY_RPC = false;
// ↑ [2단계 끄기] true 로 바꾸면 autoverify RPC 건너뛰고 바로 verified 저장(테스트용)

/* STEP1-AI-BEGIN — 블록 주석으로 끄려면 위를 true 로 두거나, 아래 if (!SKIP_SPOT_AI_VERIFY) 안만 주석 처리 */

function errorInstanceName(err: unknown): string {
  return err && typeof err === 'object' && 'name' in err && typeof (err as { name: unknown }).name === 'string'
    ? (err as { name: string }).name
    : '';
}

async function readFunctionsErrorResponseBody(context: unknown): Promise<{ error?: string; detail?: string } | null> {
  if (!context || typeof context !== 'object' || typeof (context as Response).clone !== 'function') return null;
  try {
    const j = await (context as Response).clone().json();
    return j && typeof j === 'object' ? (j as { error?: string; detail?: string }) : null;
  } catch {
    return null;
  }
}

/** AI 판독 호출 실패 시 토스트용 짧은 한글 (사진 반려와 구분) */
async function describeAiInvokeFailure(err: unknown): Promise<string> {
  const name = errorInstanceName(err);

  if (err instanceof FunctionsHttpError || name === 'FunctionsHttpError') {
    const res = (err as FunctionsHttpError).context as Response;
    const status = res.status;
    const body = await readFunctionsErrorResponseBody(res);
    const code = typeof body?.error === 'string' ? body.error : undefined;

    if (status === 404) {
      return 'AI 판독 서버를 찾을 수 없어요. 서버에 배포됐는지 이름이 ai-verify-spot-report인지 확인하세요. 사진 문제는 아니에요.';
    }
    if (status === 401 || status === 403) {
      return `로그인이나 관리자 권한이 없어요(오류 ${status}). 다시 로그인해 보세요. 사진 반려는 아니에요.`;
    }
    if (status === 503 && code === 'missing_groq') {
      return aiEdgeBodyErrorDescription('missing_groq');
    }
    if (status >= 500) {
      const base = code ? aiEdgeBodyErrorDescription(code) : `AI 판독 서버 오류(${status})`;
      return `${base} 서버 실행 로그를 확인해 주세요. 사진 반려와는 다른 단계일 수 있어요.`;
    }
    if (code) {
      return `${aiEdgeBodyErrorDescription(code)} (응답 ${status})`;
    }
    return `AI 판독 서버가 ${status}로 응답했어요. 서버 로그를 확인해 주세요.`;
  }

  if (err instanceof FunctionsRelayError || name === 'FunctionsRelayError') {
    const res = (err as FunctionsRelayError).context as Response | undefined;
    const body = res ? await readFunctionsErrorResponseBody(res) : null;
    const hint = body?.error ? ` 코드: ${body.error}.` : '';
    return `AI 판독 서버에 연결되지 않았어요.${hint} 배포·실행 오류를 로그에서 확인하세요. 사진 반려는 아니에요.`;
  }

  if (err instanceof FunctionsFetchError || name === 'FunctionsFetchError') {
    const ctx = (err as FunctionsFetchError).context as { message?: string; name?: string } | undefined;
    const inner = typeof ctx?.message === 'string' ? ctx.message : '';
    if (/abort/i.test(inner)) {
      return '요청이 끊겼거나 시간이 너무 길었어요. 다시 시도해 주세요. 사진 반려는 아니에요.';
    }
    return '네트워크가 끊겼거나, 서버에 AI 판독 기능이 없을 때예요. 사진 때문은 아니에요.';
  }

  const raw =
    err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message.trim()
      : '';
  if (/[\uAC00-\uD7AF]/.test(raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower.includes('failed to send') && lower.includes('edge')) {
    return '네트워크가 끊겼거나, 서버에 AI 판독 기능이 없을 때예요. 사진 때문은 아니에요.';
  }
  if (lower.includes('non-2xx') || /edge function returned/i.test(raw)) {
    return 'AI 판독 서버가 오류를 냈어요. 서버 로그를 확인해 주세요.';
  }
  return '원인을 알 수 없어요. 잠시 후 다시 시도하거나 서버 로그를 확인해 주세요.';
}

const AI_EDGE_BODY_ERR_KO: Record<string, string> = {
  missing_groq:
    'AI 회사(Groq) API 키가 서버에 없어요. Secrets에 GROQ_API_KEY를 넣었는지 확인하세요. 사진이 싫다는 뜻은 아니에요.',
  not_authenticated: '로그인이 풀렸어요. 다시 로그인해 주세요.',
  no_auth: '로그인 정보가 없어요. 다시 로그인해 주세요.',
  forbidden: '관리자만 쓸 수 있어요. 계정을 확인하세요.',
  not_found: '제보를 DB에서 찾지 못했어요.',
  not_owner: '본인 제보만 판독할 수 있어요.',
  wrong_status: '이미 처리된 제보예요.',
  report_id_required: '앱에서 제보 번호가 빠졌어요.',
  invalid_json: '요청 형식이 잘못됐어요.',
  server_misconfigured: '서버 기본 설정이 빠졌어요.',
  photo_fetch_failed: '저장된 사진 주소를 서버가 열지 못했어요. 사진 반려 전 단계예요.',
  groq_failed: 'AI 회사(Groq)와 통신하지 못했어요. 키·한도·장애일 수 있어요. 가짜 사진 판정 전이에요.',
  groq_parse: 'AI 답변 형식을 읽지 못했어요. 사진 반려는 아니에요.',
  update_failed: '판독 결과를 저장하지 못했어요.',
  method_not_allowed: '허용되지 않은 요청이에요.',
};

function aiEdgeBodyErrorDescription(code: string | undefined): string {
  if (!code) return '서버가 자세한 코드를 주지 않았어요. 실행 로그를 확인해 주세요.';
  return AI_EDGE_BODY_ERR_KO[code] ?? `서버 코드: ${code}. 로그를 확인해 주세요.`;
}

type UploadState = 'idle' | 'picking' | 'uploading' | 'verifying' | 'done' | 'error';

/** 일부 모바일 브라우저는 File.type이 비었거나 허용 목록에 없는 MIME을 보냄 → Storage 버킷 검사 통과용 */
function isLikelyImageFile(file: File): boolean {
  const t = file.type?.trim();
  if (t.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['png', 'webp', 'heic', 'heif', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext ?? '');
}

function inferImageContentType(file: File): string {
  const t = file.type?.trim();
  if (t && t !== 'application/octet-stream') return t;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
  };
  return byExt[ext ?? ''] ?? 'image/jpeg';
}

/**
 * 제보용: 캐시 위치 금지(maximumAge 0) — 지금 그 자리 GPS만 허용.
 * Storage 업로드보다 먼저 호출해, 위치 꺼져 있으면 파일이 올라가지 않게 함.
 */
function getCurrentPositionForSpotReport(): Promise<GeolocationPosition> {
  const tryGet = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  return tryGet({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 18_000,
  }).catch(() =>
    tryGet({
      enableHighAccuracy: false,
      maximumAge: 0,
      timeout: 16_000,
    }),
  );
}

/** Geolocation 실패 시 토스트 (PC 파일 업로드와 무관 — 좌표 권한 문제) */
function geoFailureToast(err: unknown): { title: string; description: string } {
  if (!navigator.geolocation) {
    return {
      title: '이 환경에서는 위치를 쓸 수 없어요',
      description: '브라우저가 위치 API를 지원하지 않아요. 다른 브라우저나 스마트폰에서 시도해 주세요.',
    };
  }

  const code =
    err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'number'
      ? (err as { code: number }).code
      : null;

  // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT
  if (code === 1) {
    return {
      title: '위치 권한이 꺼져 있어요',
      description:
        'PC에서 사진「파일」로 올려서가 아니라, 제보에 지금 좌표가 필요해요. 주소창 자물쇠에서 위치 허용, Windows 설정 → 개인 정보 → 위치에서 Chrome(또는 쓰는 브라우저) 허용을 확인해 주세요.',
    };
  }
  if (code === 2) {
    return {
      title: '지금 위치를 잡지 못했어요',
      description:
        'PC에는 GPS가 없어 Wi‑Fi·IP로만 잡는 경우가 많아요. 실내·VPN이면 실패할 수 있어요. 창문 근처나 모바일에서 다시 시도해 보세요.',
    };
  }
  if (code === 3) {
    return {
      title: '위치 응답이 너무 느려요',
      description: '잠시 후 다시 「제보 등록」을 눌러 주세요.',
    };
  }

  return {
    title: '내 위치를 켜 주세요',
    description:
      '카메라/앨범 구분 없이, 제보에는 브라우저 위치가 필요해요. 지도에서 내 위치를 켜고, 위치 권한을 허용해 주세요.',
  };
}

export type SpotReportFabVariant = 'floating' | 'mapToolbar';

export interface SpotReportUploadProps {
  /** 제보·검증 완료 후 마이 포인트 등 갱신 */
  onReportSubmitted?: () => void;
  /** 관리자 테스트 지도: GPS 대신 이 좌표로 제보 lat/lng 저장 */
  virtualReportLatLng?: { lat: number; lng: number } | null;
  /** 관리자만: PC 등에서 이미지 파일로 제보 가능 */
  isAdmin?: boolean;
  /** 관리자·파일 제보 시 GPS 실패하면 지도 탐색 중심(lat,lng)으로 대체 */
  adminReportFallbackLatLng?: { lat: number; lng: number } | null;
  /** mapToolbar: 지역 검색 박스 위 고정 행(헤더 아래). floating: 예전 우측 단독 배치 */
  fabVariant?: SpotReportFabVariant;
}

/** 모바일 한글 키보드가 올라올 때 입력칸이 위쪽 스크롤 영역에 오도록 */
/** getUserMedia 프레임 → JPEG File */
function videoFrameToJpegFile(video: HTMLVideoElement): Promise<File | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 2 || h < 2) return Promise.resolve(null);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(new File([blob], `spot_${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  });
}

/** 시트 내부 스크롤만 — window scrollIntoView는 지도 탭이 밀려 나가는 것처럼 보이게 함 */
function scrollInputIntoSheet(
  el: HTMLInputElement,
  container: HTMLElement | null,
) {
  const run = () => {
    if (container) {
      const pad = 16;
      const cRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      let delta = 0;
      if (elRect.top < cRect.top + pad) delta = elRect.top - cRect.top - pad;
      else if (elRect.bottom > cRect.bottom - pad) delta = elRect.bottom - cRect.bottom + pad;
      if (delta !== 0) container.scrollBy({ top: delta, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  };
  window.requestAnimationFrame(run);
  window.setTimeout(run, 100);
  window.setTimeout(run, 320);
  window.setTimeout(run, 520);
}

type PickSource = 'camera' | 'file';

export function SpotReportUpload({
  onReportSubmitted,
  virtualReportLatLng,
  isAdmin = false,
  adminReportFallbackLatLng = null,
  fabVariant = 'mapToolbar',
}: SpotReportUploadProps) {
  const { userId } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isMobileTouch = useMemo(() => isCoarsePointerDevice(), []);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [showSheet, setShowSheet] = useState(() => spotReportSheetSessionOpen);

  const setSheetOpen = (open: boolean) => {
    setSpotReportSheetSessionOpen(open); // false면 내부에서 draft도 clear
    setShowSheet(open);
  };
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraVideoReady, setCameraVideoReady] = useState(false);
  /** 모바일 키보드 — visualViewport 전체를 시트가 덮도록(top+height), 상단 딤 고스트 탭 방지 */
  const [viewportRect, setViewportRect] = useState(() => ({
    top: 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));
  // 재마운트 시 draft 복원 (키보드→뷰포트 급변으로 언마운트된 경우 대비)
  const _d = getSpotReportDraft();
  const [preview, setPreview] = useState<string | null>(_d.previewUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(_d.file);
  const [pickSource, setPickSource] = useState<PickSource | null>(_d.pickSource);
  const [placeName, setPlaceName] = useState(_d.placeName);
  const [description, setDescription] = useState(_d.description);
  const [userCategory, setUserCategory] = useState<string | null>(_d.userCategory);
  const [adminAiPhotoVerify, setAdminAiPhotoVerifyState] = useState(false);
  const [verifyUiKind, setVerifyUiKind] = useState<'none' | 'rpc' | 'ai'>('none');
  /** 제5조(현장 제보) 안내·초상권 등 — 미리보기 바뀔 때마다 다시 확인 */
  const [spotReportLegalAck, setSpotReportLegalAck] = useState(false);

  useEffect(() => {
    try {
      setAdminAiPhotoVerifyState(typeof localStorage !== 'undefined' && localStorage.getItem(SPOTVIBE_ADMIN_AI_LS) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  function setAdminAiPhotoVerify(next: boolean) {
    setAdminAiPhotoVerifyState(next);
    try {
      localStorage.setItem(SPOTVIBE_ADMIN_AI_LS, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  function stopCameraTracks() {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }

  // draft 동기화 헬퍼
  const setPreviewWithDraft = (v: string | null) => {
    setPreview(v);
    setSpotReportDraft({ previewUrl: v });
  };
  const setSelectedFileWithDraft = (v: File | null) => {
    setSelectedFile(v);
    setSpotReportDraft({ file: v });
  };
  const setPlaceNameWithDraft = (v: string) => {
    setPlaceName(v);
    setSpotReportDraft({ placeName: v });
  };
  const setDescriptionWithDraft = (v: string) => {
    setDescription(v);
    setSpotReportDraft({ description: v });
  };
  const setUserCategoryWithDraft = (v: string | null) => {
    setUserCategory(v);
    setSpotReportDraft({ userCategory: v });
  };
  const setPickSourceWithDraft = (v: PickSource | null) => {
    setPickSource(v);
    setSpotReportDraft({ pickSource: v });
  };

  function revokePreview() {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
  }

  useEffect(() => {
    if (!showSheet) {
      stopCameraTracks();
      setCameraOpen(false);
      setCameraVideoReady(false);
    }
  }, [showSheet]);

  useEffect(() => {
    if (!showSheet) {
      setViewportRect({ top: 0, height: window.innerHeight });
      return;
    }
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    if (isMobileTouch) {
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    }
    const vv = window.visualViewport;
    const syncViewportRect = () => {
      setViewportRect({
        top: vv?.offsetTop ?? 0,
        height: vv?.height ?? window.innerHeight,
      });
    };
    /** 갤럭시·안드로이드: visualViewport scroll이 지도/바텀시트를 밀어 고스트 탭 유발 → 차단 */
    const onVvScroll = (e: Event) => {
      if (isMobileTouch) e.preventDefault();
      syncViewportRect();
    };
    syncViewportRect();
    vv?.addEventListener('resize', syncViewportRect);
    vv?.addEventListener('scroll', onVvScroll, { passive: false });
    window.addEventListener('resize', syncViewportRect);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      if (isMobileTouch) window.scrollTo(0, scrollY);
      vv?.removeEventListener('resize', syncViewportRect);
      vv?.removeEventListener('scroll', onVvScroll);
      window.removeEventListener('resize', syncViewportRect);
      setViewportRect({ top: 0, height: window.innerHeight });
    };
  }, [showSheet, isMobileTouch]);

  useEffect(() => {
    setSpotReportLegalAck(false);
  }, [preview]);

  useEffect(() => {
    if (!cameraOpen) {
      setCameraVideoReady(false);
      return;
    }
    const v = videoRef.current;
    const s = cameraStreamRef.current;
    if (!v || !s) return;

    const markReady = () => {
      if (v.videoWidth >= 2 && v.videoHeight >= 2) setCameraVideoReady(true);
    };

    v.srcObject = s;
    setCameraVideoReady(false);
    v.addEventListener('loadedmetadata', markReady);
    v.addEventListener('resize', markReady);
    void v.play().then(markReady).catch(() => {});

    return () => {
      v.removeEventListener('loadedmetadata', markReady);
      v.removeEventListener('resize', markReady);
      v.srcObject = null;
      setCameraVideoReady(false);
    };
  }, [cameraOpen]);

  function handleFabClick() {
    if (!userId) {
      toast.error('로그인이 필요해요.');
      return;
    }
    setSheetOpen(true);
  }

  async function openSpotCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('이 환경에서는 카메라를 열 수 없어요.', {
        description: 'HTTPS 접속과 카메라 권한이 필요해요.',
      });
      return;
    }
    const constraintAttempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      { video: { facingMode: 'environment' }, audio: false },
      { video: true, audio: false },
    ];
    let stream: MediaStream | null = null;
    let lastErr: unknown;
    for (const constraints of constraintAttempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!stream) {
      console.warn('getUserMedia failed:', lastErr);
      toast.error('카메라를 열 수 없어요.', {
        description:
          '브라우저 설정에서 이 사이트의 카메라 권한을 허용해 주세요. 안드로이드 Chrome은 주소창 자물쇠 → 사이트 설정 → 카메라, 그리고 HTTPS 접속이 필요해요.',
      });
      return;
    }
    stopCameraTracks();
    cameraStreamRef.current = stream;
    setCameraOpen(true);
  }

  function closeSpotCamera() {
    stopCameraTracks();
    setCameraOpen(false);
  }

  async function shutterCapture() {
    const video = videoRef.current;
    if (!video) {
      toast.error('카메라가 아직 준비되지 않았어요.', { description: '잠시 후 다시 눌러 주세요.' });
      return;
    }
    if (video.videoWidth < 2) {
      try {
        await video.play();
      } catch {
        /* ignore */
      }
      await new Promise<void>((resolve) => {
        if (video.videoWidth >= 2) {
          resolve();
          return;
        }
        const done = () => {
          video.removeEventListener('loadedmetadata', done);
          resolve();
        };
        video.addEventListener('loadedmetadata', done);
        window.setTimeout(done, 1200);
      });
    }
    if (video.videoWidth < 2) {
      toast.error('카메라가 아직 준비되지 않았어요.', { description: '잠시 후 다시 눌러 주세요.' });
      return;
    }
    const file = await videoFrameToJpegFile(video);
    if (!file) {
      toast.error('촬영 저장에 실패했어요.');
      return;
    }
    revokePreview();
    closeSpotCamera();
    setSelectedFileWithDraft(file);
    setPreviewWithDraft(URL.createObjectURL(file));
    setPickSourceWithDraft('camera');
    setUploadState('picking');
  }

  /** 제보 시트는 우측 X로만 닫힘 — 배경·자동 닫기 없음 */
  function closeSheetByUser() {
    stopCameraTracks();
    setCameraOpen(false);
    revokePreview();
    clearSpotReportSheetDraft();
    setSheetOpen(false);
    setPreview(null);
    setSelectedFile(null);
    setPlaceName('');
    setDescription('');
    setUserCategory(null);
    setPickSource(null);
    setVerifyUiKind('none');
    setSpotReportLegalAck(false);
    setUploadState('idle');
  }

  /** AI·서버 반려 후에도 제보 시트·사진·제목 유지(카메라 첫 화면으로 되돌아가 창이 닫힌 것처럼 보이는 것 방지) */
  function retainDraftForRetry() {
    setVerifyUiKind('none');
    setUploadState('picking');
    setSpotReportLegalAck(false);
  }

  function onAdminFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isAdmin) {
      e.target.value = '';
      return;
    }
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!isLikelyImageFile(f)) {
      toast.error('이미지 파일만 선택할 수 있어요.');
      return;
    }
    revokePreview();
    setSelectedFileWithDraft(f);
    setPreviewWithDraft(URL.createObjectURL(f));
    setPickSourceWithDraft('file');
    setUploadState('picking');
  }

  async function handleSubmit() {
    if (!selectedFile || !userId) return;
    const titleTrim = placeName.trim();
    if (!titleTrim) {
      toast.error('장소 이름(제목)을 적어 주세요.', {
        description: '제목 없이는 등록·승인되지 않아요.',
      });
      return;
    }
    if (isSpotReportTextBlocked(placeName, description)) {
      toast.error('제목·설명을 수정해 주세요.', {
        description: '야동·음란·성희롱 등 부적절한 표현은 올릴 수 없어요.',
      });
      return;
    }
    if (!spotReportLegalAck) {
      toast.error('아래 안내를 읽고 동의에 체크해 주세요.', {
        description: '모자이크 미리보기 확인·법적 책임은 본인에게 있어요.',
      });
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      toast.error('Supabase가 설정되지 않았어요.');
      return;
    }

    setUploadState('uploading');

    let textDecision: 'allow' | 'held' | 'block' = 'allow';
    let textReason = '';

    if (SKIP_SPOT_AI_VERIFY) {
      console.info('[SpotReport] SKIP_SPOT_AI_VERIFY: 제목·사진 AI 검증 건너뜀(테스트)');
    } else {
      const { data: textModData, error: textModErr } = await sb.functions.invoke('moderate-user-content', {
        body: {
          context: 'spot_report',
          placeTitle: titleTrim,
          description: description.trim(),
        },
      });
      if (
        !textModErr &&
        textModData &&
        typeof textModData === 'object' &&
        (textModData as { ok?: boolean }).ok === true
      ) {
        const d = String((textModData as { decision?: string }).decision ?? '').toLowerCase();
        if (d === 'block' || d === 'held' || d === 'allow') {
          textDecision = d;
          textReason = String((textModData as { reason?: string }).reason ?? '');
        }
      } else if (textModErr) {
        console.warn('moderate-user-content:', textModErr);
        toast.message('제목 AI 검토를 건너뛰고 등록을 진행해요.', {
          description: '연결이 불안정할 때예요. 사진·제목은 그대로 올라갑니다.',
        });
      }

      if (textDecision === 'block') {
        setUploadState('picking');
        toast.error('게시할 수 없는 내용이에요.', {
          description:
            textReason.trim() ||
            'AI가 부적절한 제목·설명으로 판단했어요. 홍보·음란·범죄 유도 등은 올릴 수 없어요.',
        });
        return;
      }
    }

    let fileToUpload = selectedFile;
    if (preview) {
      try {
        const mosaicUrl = await buildFaceMosaicDataUrl(preview);
        if (mosaicUrl) {
          const blob = await (await fetch(mosaicUrl)).blob();
          fileToUpload = new File([blob], `spot_${Date.now()}.jpg`, { type: 'image/jpeg' });
        } else {
          toast.info('얼굴 자동 모자이크를 건너뛰고 원본을 올려요.');
        }
      } catch {
        toast.info('모자이크 처리에 실패해 원본을 올려요.');
      }
    }

    let lat: number;
    let lng: number;
    if (virtualReportLatLng && Number.isFinite(virtualReportLatLng.lat) && Number.isFinite(virtualReportLatLng.lng)) {
      lat = virtualReportLatLng.lat;
      lng = virtualReportLatLng.lng;
    } else {
      try {
        const pos = await getCurrentPositionForSpotReport();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (geoErr) {
        const canAdminFallback =
          isAdmin &&
          pickSource === 'file' &&
          adminReportFallbackLatLng &&
          Number.isFinite(adminReportFallbackLatLng.lat) &&
          Number.isFinite(adminReportFallbackLatLng.lng);
        if (canAdminFallback) {
          lat = adminReportFallbackLatLng.lat;
          lng = adminReportFallbackLatLng.lng;
          toast.message('관리자 전용', {
            description: '브라우저 위치를 받지 못해 지도 탐색 중심 좌표로 제보했어요.',
          });
        } else {
          setUploadState('picking');
          const { title, description } = geoFailureToast(geoErr);
          toast.error(title, { description });
          return;
        }
      }
    }

    const rawExt = fileToUpload.name?.trim()
      ? (fileToUpload.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'jpg')
      : 'jpg';
    const ext = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(rawExt) ? rawExt : 'jpg';
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const contentType = inferImageContentType(fileToUpload);

    const { error: uploadError } = await sb.storage
      .from('spot-photos')
      .upload(path, fileToUpload, { contentType, upsert: false });

    if (uploadError) {
      console.error('spot-photos storage:', uploadError);
      setUploadState('error');
      const code = (uploadError as { statusCode?: string }).statusCode;
      toast.error('사진 파일 업로드(Storage)에 실패했어요.', {
        description: [uploadError.message, code ? `코드 ${code}` : null].filter(Boolean).join(' · '),
      });
      return;
    }

    const { data: urlData } = sb.storage.from('spot-photos').getPublicUrl(path);
    const photoUrl = urlData.publicUrl;

    // pending 저장 후 DB RPC로 verified 확정 — 포인트는 트리거가 처리(AI·Edge 미사용)
    // SKIP_AUTOVERIFY_RPC = true 일 때는 insert 시 바로 verified 로 저장
    const insertStatus = SKIP_AUTOVERIFY_RPC
      ? 'verified'
      : textDecision === 'held'
        ? 'held'
        : 'pending';

    const { data: report, error: insertError } = await sb
      .from('spot_reports')
      .insert({
        user_id: userId,
        photo_url: photoUrl,
        lat,
        lng,
        status: insertStatus,
        place_name: titleTrim,
        description: description.trim() || null,
        user_category: userCategory || null,
        ai_reason:
          SKIP_AUTOVERIFY_RPC
            ? '테스트: 자동 verified'
            : textDecision === 'held'
              ? (textReason.trim() || 'AI 텍스트 검토 보류')
              : null,
        ai_label: SKIP_AUTOVERIFY_RPC ? '현장 제보' : null,
        ai_category: SKIP_AUTOVERIFY_RPC ? 'other' : null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('spot_reports insert:', insertError);
      await sb.storage.from('spot-photos').remove([path]);
      setUploadState('error');
      const msg = insertError.message ?? '';
      if (msg.includes('SPOTVIBE_BLOCKED_TEXT')) {
        toast.error('제목·설명을 수정해 주세요.', {
          description: '야동·음란·성희롱 등 부적절한 표현은 올릴 수 없어요.',
        });
      } else {
        toast.error('제보 DB 저장에 실패했어요.', { description: msg });
      }
      return;
    }

    if (!report?.id) {
      await sb.storage.from('spot-photos').remove([path]);
      setUploadState('error');
      toast.error('제보 ID를 받지 못했어요.');
      return;
    }

    // SKIP_AUTOVERIFY_RPC: RPC 없이 바로 완료
    if (SKIP_AUTOVERIFY_RPC) {
      setVerifyUiKind('none');
      setUploadState('done');
      toast.success('제보 완료! +10 포인트 적립 ✅  현장 제보');
      onReportSubmitted?.();
      return;
    }

    if (!SKIP_SPOT_AI_VERIFY && textDecision === 'held') {
      setVerifyUiKind('none');
      setUploadState('done');
      toast.success('접수됐어요. 내용이 검토 중입니다.', {
        description: `${textReason.trim() ? `${textReason.trim()} · ` : ''}승인 후 실시간 피드에 공개돼요.`,
      });
      clearSpotReportSheetDraft();
      setSelectedFileWithDraft(null);
      setPreviewWithDraft(null);
      setPickSourceWithDraft(null);
      setPlaceNameWithDraft('');
      setDescriptionWithDraft('');
      setUserCategoryWithDraft(null);
      onReportSubmitted?.();
      return;
    }

    /** 관리자 + AI 판독 ON이면 카메라·파일 모두 Edge 비전 검사 (SKIP_SPOT_AI_VERIFY 시 항상 RPC만) */
    const useAiEdge = !SKIP_SPOT_AI_VERIFY && isAdmin && adminAiPhotoVerify;
    setVerifyUiKind(useAiEdge ? 'ai' : 'rpc');
    setUploadState('verifying');

    let finalizeUsedAiEdge = false;
    try {
      if (useAiEdge) {
        finalizeUsedAiEdge = true;
        const { data: fnData, error: fnError } = await sb.functions.invoke('ai-verify-spot-report', {
          body: { reportId: report.id },
        });
        if (fnError) {
          console.error('ai-verify-spot-report:', fnError);
          setVerifyUiKind('none');
          setUploadState('error');
          toast.error('AI 판독 실패', { description: await describeAiInvokeFailure(fnError) });
          return;
        }
        const ai = fnData as {
          ok?: boolean;
          verified?: boolean;
          rejected?: boolean;
          label?: string;
          reason?: string;
          error?: string;
        } | null;
        if (!ai?.ok) {
          setVerifyUiKind('none');
          setUploadState('error');
          toast.error('AI 판독 실패', { description: aiEdgeBodyErrorDescription(ai?.error) });
          return;
        }
        if (ai.rejected) {
          toast.error('AI가 이 사진을 현장 제보로 승인하지 않았어요.', {
            description: [ai.reason, '제목·설명을 고친 뒤 다시 「제보 등록」을 눌러 주세요.'].filter(Boolean).join(' '),
            duration: 8000,
          });
          retainDraftForRetry();
          onReportSubmitted?.();
          return;
        }
        const label = ai.label ?? '현장 제보';
        setUploadState('done');
        toast.success(`제보 완료! +10 포인트 적립 ✅  ${label}`);
        onReportSubmitted?.();
        return;
      }

      const { data: rpcData, error: rpcError } = await sb.rpc('autoverify_own_spot_report', {
        p_report_id: report.id,
      });
      if (rpcError) {
        console.error('autoverify_own_spot_report:', rpcError);
        setVerifyUiKind('none');
        setUploadState('error');
        toast.error('제보 확정에 실패했어요.', {
          description: `${rpcError.message} · Supabase에 autoverify_own_spot_report 마이그레이션을 적용했는지 확인해 주세요.`,
        });
        return;
      }
      const rpc = rpcData as { ok?: boolean; error?: string; label?: string } | null;
      if (!rpc?.ok) {
        setVerifyUiKind('none');
        if (rpc?.error === 'title_required') {
          toast.error('장소 이름(제목)이 필요해요.', {
            description: '제목을 적은 뒤 다시 「제보 등록」을 눌러 주세요.',
          });
          retainDraftForRetry();
          onReportSubmitted?.();
          return;
        }
        if (rpc?.error === 'blocked_text') {
          toast.error('제목·설명을 수정해 주세요.', {
            description: '부적절한 표현은 올릴 수 없어요. 문구만 고친 뒤 다시 등록해 주세요.',
          });
          retainDraftForRetry();
          onReportSubmitted?.();
          return;
        }
        setUploadState('error');
        const why =
          rpc?.error === 'not_owner'
            ? '본인 제보만 확정할 수 있어요.'
            : rpc?.error === 'wrong_status'
              ? '이미 처리된 제보예요.'
              : rpc?.error === 'not_found'
                ? '제보를 찾을 수 없어요.'
                : rpc?.error === 'not_authenticated'
                  ? '다시 로그인한 뒤 시도해 주세요.'
                  : (rpc?.error ?? 'not_ok');
        toast.error('제보 확정에 실패했어요.', { description: why });
        return;
      }
      const label = rpc.label ?? '현장 제보';
      setUploadState('done');
      toast.success(`제보 완료! +10 포인트 적립 ✅  ${label}`);
      onReportSubmitted?.();
    } catch (err) {
      console.error('spot report finalize error:', err);
      setVerifyUiKind('none');
      setUploadState('error');
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : err instanceof Error
            ? err.message
            : String(err);
      if (finalizeUsedAiEdge) {
        toast.error('AI 판독 실패', { description: await describeAiInvokeFailure(err) });
      } else {
        toast.error('제보 처리 중 오류가 났어요', { description: msg || '잠시 후 다시 시도해 주세요.' });
      }
    }
  }

  /* STEP1-AI-END */

  const isProcessing = uploadState === 'uploading' || uploadState === 'verifying';
  const contentBlocked = useMemo(
    () => isSpotReportTextBlocked(placeName, description),
    [placeName, description],
  );
  const canSubmit =
    !!selectedFile &&
    !isProcessing &&
    placeName.trim().length > 0 &&
    !contentBlocked &&
    spotReportLegalAck;
  /** 하단 고정 버튼 줄 — 그 외 상태는 탭바·홈 인디케이터와 겹치지 않게 여백 */
  const hasStickyFooter = uploadState === 'picking' && !isProcessing;
  const sheetBodyBottomPad = hasStickyFooter
    ? undefined
    : 'max(1.25rem, calc(5.75rem + env(safe-area-inset-bottom, 0px)))';

  const handleSheetFieldFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    scrollInputIntoSheet(e.target, sheetScrollRef.current);
  };

  /**
   * 갤럭시 등 Android: React stopPropagation 만으로는 네이티브 DOM 이벤트가
   * 지도 클릭 핸들러까지 전달될 수 있어, nativeEvent.stopImmediatePropagation 도 함께 호출.
   */
  const stopSheetPointerBubble = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    try { (e.nativeEvent as Event).stopImmediatePropagation(); } catch { /* ignore */ }
  };

  const sheetLayoutStyle: CSSProperties = isMobileTouch
    ? {
        top: viewportRect.top,
        left: 0,
        right: 0,
        bottom: 'auto',
        width: '100%',
        height: viewportRect.height,
        maxHeight: viewportRect.height,
      }
    : {
        top: 'auto',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'auto',
        maxHeight: Math.min(720, Math.round(viewportRect.height * 0.92)),
      };

  const sheetPortalContent = (
    <AnimatePresence>
      {showSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[430] touch-none"
            role="presentation"
          >
            {/* 딤 — 탭 불가(배경 탭으로 닫히지 않음) */}
            <motion.div
              className="pointer-events-none absolute inset-0 bg-black/65"
              aria-hidden
            />

            <motion.div
              initial={isMobileTouch ? { opacity: 0 } : { y: '100%' }}
              animate={isMobileTouch ? { opacity: 1 } : { y: 0 }}
              exit={isMobileTouch ? { opacity: 0 } : { y: '100%' }}
              transition={
                isMobileTouch
                  ? { duration: 0.18, ease: 'easeOut' }
                  : { type: 'spring', damping: 28, stiffness: 300 }
              }
              role="dialog"
              aria-modal="true"
              aria-labelledby="spot-report-sheet-title"
              className="fixed z-[1] flex touch-auto flex-col rounded-t-2xl border-t border-white/10 bg-[#13131C] shadow-[0_-12px_48px_rgba(0,0,0,0.5)]"
              style={sheetLayoutStyle}
              onPointerDown={stopSheetPointerBubble}
              onPointerUp={stopSheetPointerBubble}
              onClick={stopSheetPointerBubble}
              onTouchStart={stopSheetPointerBubble}
            >
              <div className="shrink-0 px-5 pb-2 pt-4">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p id="spot-report-sheet-title" className="text-[16px] font-bold text-white">
                      현장 제보
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-white/40">
                      제보마다 <span className="font-bold text-[#00F0FF]">+10 포인트</span> 적립돼요
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeSheetByUser}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/08 text-white/50"
                    aria-label="제보 창 닫기"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div
                ref={sheetScrollRef}
                className={`flex min-h-0 flex-1 flex-col px-5 overflow-y-auto overscroll-y-contain ${
                  hasStickyFooter ? 'pb-2' : ''
                }`}
                style={sheetBodyBottomPad ? { paddingBottom: sheetBodyBottomPad } : undefined}
              >
                {uploadState === 'idle' && !cameraOpen && (
                  <>
                    <button
                      type="button"
                      onClick={() => void openSpotCamera()}
                      className="mb-3 flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed py-8 transition-all active:scale-[0.98]"
                      style={{ borderColor: 'rgba(0,240,255,0.25)', backgroundColor: 'rgba(0,240,255,0.04)' }}
                    >
                      <Camera size={30} color="#00F0FF" strokeWidth={2} />
                      <div className="text-center">
                        <p className="text-[13px] font-semibold" style={{ color: '#00F0FF' }}>
                          실시간 카메라로 촬영
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/28">
                          앨범·파일 선택 없이 <span className="font-semibold text-white/45">지금 카메라 화면만</span> 촬영해요. 등록 시
                          얼굴은 자동 모자이크된 JPEG로 올라가요. (HTTPS·카메라 권한 필요)
                        </p>
                      </div>
                    </button>
                    {isAdmin && (
                      <>
                        <div className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={adminAiPhotoVerify}
                            onClick={() => setAdminAiPhotoVerify(!adminAiPhotoVerify)}
                            className="flex w-full items-center justify-between transition-all active:scale-[0.99]"
                          >
                            <span className="text-[12px] font-semibold text-amber-100">AI 판독</span>
                            <span
                              className={`text-[11px] font-bold tabular-nums ${adminAiPhotoVerify ? 'text-emerald-400' : 'text-white/35'}`}
                            >
                              {adminAiPhotoVerify ? 'ON' : 'OFF'}
                            </span>
                          </button>
                          <p className="mt-1.5 text-[10px] leading-snug text-amber-100/55">
                            ON이면 <span className="font-semibold text-amber-100/80">관리자 테스트용</span> 비전 AI가 실내·카페 등을 엄하게 반려할 수 있어요. 일반 이용자는 OFF와 같이 자동 승인됩니다.
                          </p>
                        </div>
                        <input
                          ref={adminFileInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          aria-hidden
                          tabIndex={-1}
                          onChange={onAdminFileInputChange}
                        />
                        <button
                          type="button"
                          onClick={() => adminFileInputRef.current?.click()}
                          className="mb-4 flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed py-5 transition-all active:scale-[0.98]"
                          style={{ borderColor: 'rgba(251,191,36,0.35)', backgroundColor: 'rgba(251,191,36,0.06)' }}
                        >
                          <ImagePlus size={28} color="#FBBF24" strokeWidth={2} />
                          <p className="text-[13px] font-semibold text-amber-200">이미지 파일에서 등록</p>
                        </button>
                      </>
                    )}
                  </>
                )}

                {uploadState === 'idle' && cameraOpen && (
                  <div className="mb-4 flex flex-col gap-3">
                    <div
                      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/12 bg-black"
                      style={{ maxHeight: 'min(52dvh, 22rem)' }}
                    >
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={closeSpotCamera}
                        className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] py-3 text-[13px] font-semibold text-white/65 transition-all active:scale-[0.98]"
                      >
                        닫기
                      </button>
                      <button
                        type="button"
                        disabled={!cameraVideoReady}
                        onClick={() => void shutterCapture()}
                        className="flex-1 rounded-xl border py-3 text-[13px] font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                        style={{
                          borderColor: 'rgba(0,240,255,0.55)',
                          backgroundColor: 'rgba(0,240,255,0.2)',
                          color: '#00F0FF',
                        }}
                      >
                        {cameraVideoReady ? '촬영' : '카메라 준비 중…'}
                      </button>
                    </div>
                  </div>
                )}

                {/* picking: 키보드에 안 가리도록 입력란을 맨 위, 미리보기는 아래 */}
                {uploadState === 'picking' && !isProcessing && (
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <div className="shrink-0 scroll-mt-2">
                      <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/55">
                        <Pencil size={11} />
                        장소 이름 <span className="font-normal text-white/35">(필수)</span>
                      </label>
                      <input
                        type="text"
                        enterKeyHint="next"
                        value={placeName}
                        onChange={(e) => setPlaceNameWithDraft(e.target.value)}
                        onFocus={handleSheetFieldFocus}
                        onPointerDown={stopSheetPointerBubble}
                        onTouchStart={stopSheetPointerBubble}
                        onTouchEnd={stopSheetPointerBubble}
                        onClick={stopSheetPointerBubble}
                        placeholder="예: 홍대 걷고싶은거리, 여의도 한강공원"
                        maxLength={50}
                        autoComplete="off"
                        inputMode="text"
                        className="w-full touch-manipulation rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[14px] text-white placeholder-white/25 outline-none focus:border-[#00F0FF]/40"
                      />
                    </div>
                    <div className="shrink-0 scroll-mt-2">
                      <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/55">
                        <MessageSquare size={11} />
                        지금 무슨 일이 있나요?
                      </label>
                      <input
                        type="text"
                        enterKeyHint="done"
                        value={description}
                        onChange={(e) => setDescriptionWithDraft(e.target.value)}
                        onFocus={handleSheetFieldFocus}
                        onPointerDown={stopSheetPointerBubble}
                        onTouchStart={stopSheetPointerBubble}
                        onTouchEnd={stopSheetPointerBubble}
                        onClick={stopSheetPointerBubble}
                        placeholder="예: 버스킹 공연 중, 플리마켓 열렸어요"
                        maxLength={80}
                        autoComplete="off"
                        inputMode="text"
                        className="w-full touch-manipulation rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[14px] text-white placeholder-white/25 outline-none focus:border-[#00F0FF]/40"
                      />
                    </div>
                    {/* 카테고리 선택 */}
                    <div className="shrink-0 scroll-mt-2">
                      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-white/55">
                        <span className="text-[11px] leading-none">🏷️</span>
                        카테고리 <span className="font-normal text-white/35">(선택)</span>
                      </label>
                      <div
                        onPointerDown={stopSheetPointerBubble}
                        onTouchStart={stopSheetPointerBubble}
                        onTouchEnd={stopSheetPointerBubble}
                        onClick={stopSheetPointerBubble}
                        className="flex flex-wrap gap-1.5"
                      >
                        {PHOTO_CATEGORIES.map((cat) => {
                          const active = userCategory === cat.key;
                          return (
                            <button
                              key={cat.key}
                              type="button"
                              onClick={() => setUserCategoryWithDraft(active ? null : cat.key)}
                              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors"
                              style={{
                                background: active ? 'rgba(0,240,255,0.18)' : 'rgba(255,255,255,0.05)',
                                border: active ? '1px solid rgba(0,240,255,0.55)' : '1px solid rgba(255,255,255,0.10)',
                                color: active ? '#00F0FF' : 'rgba(255,255,255,0.55)',
                              }}
                            >
                              <span className="text-[12px] leading-none">{cat.emoji}</span>
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {contentBlocked ? (
                      <p className="shrink-0 text-[10px] leading-snug text-red-400/95">
                        제목·설명에 부적절하거나 서비스와 맞지 않는 표현(야동·음란·성희롱 등)이 있으면 등록할 수 없어요.
                      </p>
                    ) : null}
                    <div className="flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2">
                      <MapPin size={12} color="#4ADE80" />
                      <p className="text-[10.5px] leading-snug text-white/50">
                        {pickSource === 'file' ? (
                          <>
                            <span className="font-semibold text-amber-100/90">관리자·파일 제보</span>예요. 제보 시{' '}
                            <span className="font-semibold text-white/65">얼굴 자동 모자이크</span> 후 올라가요. 위치는{' '}
                            <span className="font-semibold text-white/65">브라우저 GPS</span>가 되면 그 좌표, PC에서 안 될 때는{' '}
                            <span className="font-semibold text-white/65">지도 탐색 중심</span> 좌표로 붙어요.
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-white/60">실시간 카메라</span>로 찍은 한 장만 등록돼요. 제보 시{' '}
                            <span className="font-semibold text-white/65">얼굴 자동 모자이크</span> 후 업로드되고,{' '}
                            <span className="font-semibold text-white/65">지금 위치</span> 좌표가 붙어요.
                          </>
                        )}
                      </p>
                    </div>
                    {preview && (
                      <div className="min-h-0 shrink overflow-hidden rounded-xl border border-white/10">
                        <FaceMosaicImage
                          src={preview}
                          alt="미리보기"
                          className="relative max-h-[min(26dvh,9rem)] w-full overflow-hidden"
                          imgClassName="max-h-[min(26dvh,9rem)] w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}

                {uploadState === 'idle' && !cameraOpen && (
                  <p className="pb-4 text-center text-[11px] leading-relaxed text-white/35">
                    위에서 카메라를 연 뒤 <span className="font-semibold text-white/45">촬영</span>을 눌러 주세요. 이후 제목을 적고{' '}
                    <span className="font-semibold text-white/50">제보 등록</span>으로 올려요.
                  </p>
                )}

                {isProcessing && preview && (
                  <div className="mb-3 shrink-0 overflow-hidden rounded-xl border border-white/10">
                    <FaceMosaicImage
                      src={preview}
                      alt="미리보기"
                      className="relative h-24 w-full"
                      imgClassName="h-24 w-full object-cover"
                    />
                  </div>
                )}

                {isProcessing && (
                  <div className="flex flex-col items-center gap-3 py-5">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="h-6 w-6 rounded-full border-2 border-white/20 border-t-[#A855F7]"
                    />
                    <p className="text-[13px] font-semibold text-white/60">
                      {uploadState === 'uploading'
                        ? '얼굴 처리 중...'
                        : verifyUiKind === 'ai'
                          ? 'AI 판독 중...'
                          : '등록 확정 중...'}
                    </p>
                    {uploadState === 'uploading' ? (
                      <p className="text-[11px] text-white/45">
                        얼굴 자동 모자이크 처리 → AI 사진·글 판독 → 등록 또는 거절
                      </p>
                    ) : verifyUiKind === 'ai' ? (
                      <p className="text-[11px] text-white/45">
                        얼굴 자동 모자이크 처리 → AI 사진·글 판독 → 등록 또는 거절
                      </p>
                    ) : verifyUiKind === 'rpc' ? (
                      <p className="text-[11px] text-white/45">얼굴 자동 모자이크 처리 → 자동 승인 → 등록</p>
                    ) : null}
                  </div>
                )}

                {uploadState === 'done' && (
                  <div className="flex flex-col items-center gap-2 py-5">
                    <CheckCircle size={30} color="#4ADE80" />
                    <p className="text-[14px] font-bold text-white">제보 완료!</p>
                    <p className="text-[12px] text-[#00F0FF]">+10 포인트 적립됐어요</p>
                    <p className="mt-1 text-[11px] text-white/40">우측 ✕ 버튼으로 닫아 주세요</p>
                  </div>
                )}

                {uploadState === 'error' && (
                  <div className="flex min-h-[min(40dvh,220px)] flex-1 flex-col items-center justify-center gap-4 px-2 py-6 text-center">
                    <AlertCircle size={28} color="#FF6B6B" className="shrink-0" />
                    <p className="max-w-[260px] text-[13px] font-semibold leading-snug text-white/75">
                      다시 시도해 주세요
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        clearSpotReportSheetDraft();
                        setVerifyUiKind('none');
                        setSpotReportLegalAck(false);
                        setUploadState('idle');
                        setPreviewWithDraft(null);
                        setSelectedFileWithDraft(null);
                        setPickSourceWithDraft(null);
                      }}
                      className="shrink-0 rounded-full border border-white/15 px-5 py-2.5 text-[12px] font-semibold text-white/70"
                    >
                      처음부터
                    </button>
                  </div>
                )}
              </div>

              {uploadState === 'picking' && !isProcessing && (
                <div
                  className="shrink-0 border-t border-white/10 bg-[#13131C] px-5 pt-3"
                  style={{
                    /* App 하단 탭바(NavigationBar)가 지도 위에 겹침 → 푸터가 가려지지 않도록 */
                    paddingBottom:
                      'max(14px, calc(5.75rem + env(safe-area-inset-bottom, 0px)))',
                  }}
                >
                  <p className="mb-2.5 text-[10px] leading-snug text-white/42">
                    법적 책임은 <span className="font-semibold text-white/55">본인</span>에게 있습니다. 위
                    모자이크 미리보기를 꼼꼼히 보시고, 타인 초상·권리를 침해하지 않는지 확인한 뒤 올려 주세요.                     자세한
                    내용은{' '}
                    <a
                      href="/terms#spot-report-terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#00F0FF]/85 underline decoration-[#00F0FF]/35 underline-offset-2"
                    >
                      이용약관 제5조
                    </a>
                    를 참고해 주세요.
                  </p>
                  <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={spotReportLegalAck}
                      onChange={(e) => setSpotReportLegalAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/25 bg-[#13131C] text-[#00F0FF] focus:ring-[#00F0FF]/40"
                    />
                    <span className="text-[11px] leading-snug text-white/58">
                      모자이크 결과를 확인했고, 제보에 대한 법적 책임이 본인에게 있음을 이해했으며, 제3자(초상권
                      등) 분쟁 시 본인이 부담함에 동의합니다.
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const wasFile = pickSource === 'file';
                        clearSpotReportSheetDraft();
                        setSelectedFileWithDraft(null);
                        setPreviewWithDraft(null);
                        setPickSourceWithDraft(null);
                        setUploadState('idle');
                        if (!wasFile) void openSpotCamera();
                      }}
                      className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] py-3.5 text-[13px] font-semibold text-white/70 transition-all active:scale-[0.98]"
                    >
                      {pickSource === 'file' ? '다시 고르기' : '다시 찍기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={!canSubmit}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3.5 text-[13px] font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                      style={{
                        borderColor: 'rgba(0,240,255,0.55)',
                        backgroundColor: 'rgba(0,240,255,0.18)',
                        color: '#00F0FF',
                        boxShadow: '0 0 16px rgba(0,240,255,0.28)',
                      }}
                    >
                      <Upload size={16} strokeWidth={2.2} />
                      제보 등록
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );

  return (
    <>
      {/* FAB — mapToolbar: 지역 검색 블록 위 / floating: 구형 우측 단독 */}
      <motion.button
        type="button"
        onClick={handleFabClick}
        whileTap={{ scale: 0.92 }}
        className={
          fabVariant === 'mapToolbar'
            ? 'pointer-events-auto absolute right-4 top-[4.65rem] z-[419] flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg'
            : 'pointer-events-auto absolute right-4 top-[13rem] z-[420] flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg'
        }
        style={{
          background: 'rgba(0,240,255,0.12)',
          border: '1px solid rgba(0,240,255,0.5)',
          boxShadow: '0 0 18px rgba(0,240,255,0.35)',
        }}
        aria-label="현장 제보 올리기"
      >
        <Camera size={20} color="#00F0FF" strokeWidth={2.2} />
      </motion.button>

      {/* 딤·시트를 document.body에 portal로 렌더링
          → 루트 스태킹 컨텍스트에서 z-[430]/z-[440]이 되어
            MapArea 래퍼(z-0 SC) 안에 갇히지 않고 NavigationBar(z-30)보다 위에 표시됨 */}
      {createPortal(sheetPortalContent, document.body)}
    </>
  );
}
