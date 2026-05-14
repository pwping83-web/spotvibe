import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { edgeFnBodyFields, koreanReasonFromEdgeInvoke } from '@/lib/edgeFunctionKorean';
import { kstTodayStartIsoUtc } from '@/lib/sosDailyQuota';
import { assertSosPhotoTakenRecently } from '@/lib/sosPhotoIntegrity';
import { blobToBase64, compressImageFileToJpegBlob } from '@/lib/sosPhoto';
import { getSupabase } from '@/lib/supabaseClient';
import type { SosSignal, SosSignalType } from '@/types/sos';

const RADIUS_KM = 3;
const EXPIRE_POLL_MS = 60_000; // 1분마다 만료 정리

function bboxDeltas(center: [number, number], radiusKm: number) {
  const latDelta = radiusKm / 111;
  const cosLat = Math.cos((center[0] * Math.PI) / 180);
  const lngDelta = radiusKm / (111 * Math.max(cosLat, 0.01));
  return { latDelta, lngDelta };
}

interface UseSosSignalsOptions {
  center: [number, number] | null;
  myUserId: string | null;
  enabled: boolean;
  /** 관리자 계정은 일일 SOS 횟수 제한 없음 */
  isAdmin?: boolean;
}

interface SendSosOptions {
  signalType: SosSignalType;
  lat: number;
  lng: number;
  note?: string;
  photoFile?: File | null;
}

export function useSosSignals({ center, myUserId, enabled, isAdmin = false }: UseSosSignalsOptions) {
  const [signals, setSignals] = useState<SosSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [myActiveSignalId, setMyActiveSignalId] = useState<string | null>(null);
  const [sosDailyLimitReached, setSosDailyLimitReached] = useState(false);
  const realtimeRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSignals = useCallback(async (c: [number, number]) => {
    const sb = getSupabase();
    if (!sb) return;
    const { latDelta, lngDelta } = bboxDeltas(c, RADIUS_KM);
    const now = new Date().toISOString();

    const { data } = await sb
      .from('sos_signals')
      .select(
        'id, user_id, signal_type, lat, lng, note, status, created_at, expires_at, resolved_at, responders_count, photo_url',
      )
      .eq('status', 'active')
      .gt('expires_at', now)
      .gte('lat', c[0] - latDelta)
      .lte('lat', c[0] + latDelta)
      .gte('lng', c[1] - lngDelta)
      .lte('lng', c[1] + lngDelta)
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) {
      setSignals(data as SosSignal[]);
      if (myUserId) {
        const mine = (data as SosSignal[]).find((s) => s.user_id === myUserId);
        setMyActiveSignalId(mine?.id ?? null);
      }
    }
  }, [myUserId]);

  // 만료된 신호 클라이언트 측 정리
  const pruneExpired = useCallback(() => {
    const now = Date.now();
    setSignals((prev) => prev.filter((s) => new Date(s.expires_at).getTime() > now));
  }, []);

  useEffect(() => {
    if (!enabled || !center) return;
    const sb = getSupabase();
    if (!sb) return;

    setLoading(true);
    fetchSignals(center).finally(() => setLoading(false));

    // Realtime 구독
    const channel = sb
      .channel('sos_signals_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_signals' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as SosSignal;
          if (row.status === 'active') {
            setSignals((prev) => [row, ...prev.filter((s) => s.id !== row.id)]);
          }
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as SosSignal;
          if (row.status !== 'active') {
            setSignals((prev) => prev.filter((s) => s.id !== row.id));
            if (myUserId && row.user_id === myUserId) setMyActiveSignalId(null);
          } else {
            setSignals((prev) => prev.map((s) => (s.id === row.id ? row : s)));
          }
        } else if (payload.eventType === 'DELETE') {
          setSignals((prev) => prev.filter((s) => s.id !== (payload.old as SosSignal).id));
        }
      })
      .subscribe();
    realtimeRef.current = channel;

    // 만료 정리 폴링
    pollRef.current = setInterval(pruneExpired, EXPIRE_POLL_MS);

    return () => {
      sb.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [enabled, center, fetchSignals, pruneExpired, myUserId]);

  const refreshSosDailyQuota = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !myUserId) {
      setSosDailyLimitReached(false);
      return;
    }
    if (isAdmin) {
      setSosDailyLimitReached(false);
      return;
    }
    const dayStart = kstTodayStartIsoUtc();
    const { count, error } = await sb
      .from('sos_signals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', myUserId)
      .gte('created_at', dayStart);
    if (error) return;
    setSosDailyLimitReached((count ?? 0) >= 1);
  }, [myUserId, isAdmin]);

  useEffect(() => {
    if (!enabled || !myUserId) return;
    void refreshSosDailyQuota();
  }, [enabled, myUserId, refreshSosDailyQuota]);

  const sendSignal = useCallback(async ({ signalType, lat, lng, note, photoFile }: SendSosOptions) => {
    const sb = getSupabase();
    if (!sb || !myUserId) return { error: 'not_logged_in' };

    if (!isAdmin) {
      const dayStart = kstTodayStartIsoUtc();
      const { count: todayCount, error: countErr } = await sb
        .from('sos_signals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', myUserId)
        .gte('created_at', dayStart);
      if (countErr) return { error: 'quota_check_failed' };
      if ((todayCount ?? 0) >= 1) {
        setSosDailyLimitReached(true);
        return { error: 'sos_daily_limit' };
      }
    }

    const noteTrim = (note ?? '').trim();
    if (noteTrim.length > 0) {
      const { data: modData, error: modErr } = await sb.functions.invoke('moderate-user-content', {
        body: {
          context: 'sos_note',
          placeTitle: '',
          description: noteTrim,
        },
      });
      if (!modErr && modData && typeof modData === 'object' && (modData as { ok?: boolean }).ok === true) {
        const dec = String((modData as { decision?: string }).decision ?? '').toLowerCase();
        if (dec === 'block') {
          return {
            error: 'sos_note_blocked',
            reason:
              String((modData as { reason?: string }).reason ?? '').trim() ||
              '메모 내용을 수정해 주세요. 홍보·음란·범죄 관련 문구는 보낼 수 없어요.',
          };
        }
      } else if (modErr) {
        const { error: errCode } = edgeFnBodyFields(modData);
        const aiDown =
          errCode === 'missing_groq' ||
          errCode === 'server_misconfigured' ||
          errCode === 'groq_failed' ||
          errCode === 'groq_parse';
        if (aiDown) {
          toast.warning(koreanReasonFromEdgeInvoke(modData), {
            description: '메모는 AI 검사 없이 전송을 시도해요. 설정을 확인해 주세요.',
          });
        }
        console.warn('[SOS] moderate-user-content:', modErr, modData);
      }
    }

    let photoUrl: string | null = null;
    let aiPhotoSummary: string | null = null;

    if (photoFile && photoFile.size > 0) {
      const integrity = await assertSosPhotoTakenRecently(photoFile, { isAdmin });
      if (!integrity.ok) {
        return { error: 'sos_photo_integrity_failed', reason: integrity.reason };
      }

      let jpeg: Blob;
      try {
        jpeg = await compressImageFileToJpegBlob(photoFile);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '사진을 처리할 수 없어요.';
        return { error: 'photo_compress_failed', reason: msg };
      }

      const imageBase64 = await blobToBase64(jpeg);
      const { data: verifyData, error: fnError } = await sb.functions.invoke('verify-sos-photo', {
        body: {
          signalType,
          imageBase64,
          mimeType: 'image/jpeg',
        },
      });

      if (fnError) {
        let reason = koreanReasonFromEdgeInvoke(
          verifyData,
          '사진 확인에 실패했어요. 잠시 후 다시 시도해 주세요.',
        );
        const ctx = (fnError as { context?: unknown }).context;
        if (ctx instanceof Response) {
          try {
            const j = (await ctx.json()) as Record<string, unknown>;
            reason = koreanReasonFromEdgeInvoke(j, reason);
          } catch {
            /* ignore */
          }
        }
        return { error: 'sos_photo_verify_failed', reason };
      }

      const v = verifyData as {
        ok?: boolean;
        approve?: boolean;
        summary?: string;
        reason?: string;
      };

      if (!v || v.ok !== true || v.approve === false) {
        const reason =
          typeof v?.reason === 'string' && v.reason.trim()
            ? v.reason.trim()
            : '선택한 유형과 맞는 현장 사진을 올려 주세요.';
        return { error: 'sos_photo_rejected', reason };
      }

      aiPhotoSummary =
        typeof v.summary === 'string' && v.summary.trim() ? v.summary.trim().slice(0, 500) : null;

      const path = `${myUserId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`;
      const { error: uploadErr } = await sb.storage.from('sos-photos').upload(path, jpeg, {
        contentType: 'image/jpeg',
        upsert: false,
      });

      if (uploadErr) {
        return {
          error: 'photo_upload_failed',
          reason:
            '사진을 서버에 올리지 못했어요. 네트워크·용량을 확인한 뒤 다시 시도해 주세요.',
        };
      }

      const { data: pub } = sb.storage.from('sos-photos').getPublicUrl(path);
      photoUrl = pub.publicUrl;
    }

    const basePayload = {
      user_id: myUserId,
      signal_type: signalType,
      lat,
      lng,
      note: note || null,
    };
    const fullPayload = {
      ...basePayload,
      photo_url: photoUrl,
      ai_photo_summary: aiPhotoSummary,
    };

    let { data, error } = await sb.from('sos_signals').insert(fullPayload).select().single();

    // 일부 배포 환경(구 스키마)에서 사진 컬럼 동기화가 늦은 경우, 사진 없이 최소 필드 저장 재시도
    if (error && !photoUrl) {
      const msg = (error.message ?? '').toLowerCase();
      const retryableBySchema =
        msg.includes('photo_url') ||
        msg.includes('ai_photo_summary') ||
        msg.includes('column') ||
        msg.includes('schema cache');
      if (retryableBySchema) {
        const retry = await sb.from('sos_signals').insert(basePayload).select().single();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('sos_daily_limit') || error.code === '23514') {
        setSosDailyLimitReached(true);
        return { error: 'sos_daily_limit' };
      }
      return {
        error: 'save_failed',
        reason: msg.trim() || 'SOS 저장 중 문제가 발생했어요.',
      };
    }
    if (!isAdmin) setSosDailyLimitReached(true);
    setMyActiveSignalId((data as SosSignal).id);
    return { data: data as SosSignal };
  }, [myUserId, isAdmin]);

  const resolveMySignal = useCallback(async (): Promise<{ error?: string }> => {
    const sb = getSupabase();
    if (!sb) return { error: 'no_client' };
    if (!myActiveSignalId) return { error: 'no_active_signal' };

    const { error } = await sb
      .from('sos_signals')
      .update({ status: 'resolved' })
      .eq('id', myActiveSignalId);

    if (error) return { error: error.message };

    setMyActiveSignalId(null);
    setSignals((prev) => prev.filter((s) => s.id !== myActiveSignalId));
    return {};
  }, [myActiveSignalId]);

  const respondToSignal = useCallback(async (signalId: string) => {
    const sb = getSupabase();
    if (!sb || !myUserId) return { error: 'not_logged_in' };

    const { error } = await sb
      .from('sos_signals')
      .update({ responder_id: myUserId, responded_at: new Date().toISOString() })
      .eq('id', signalId);

    return error ? { error: error.message } : { ok: true };
  }, [myUserId]);

  return {
    signals,
    loading,
    myActiveSignalId,
    sosDailyLimitReached,
    refreshSosDailyQuota,
    sendSignal,
    resolveMySignal,
    respondToSignal,
  };
}
