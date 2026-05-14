import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Send, Info } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { haversineMeters } from '@/lib/geoDistance';
import { toast } from 'sonner';

type Recipient = { id: string; distM: number };

export interface ViNeighborSendSheetProps {
  open: boolean;
  onClose: () => void;
  /** 현재 지도 기준점(탐색 중심 또는 내 위치) */
  anchorLatLng: { lat: number; lng: number } | null;
  myUserId: string | null;
  /** Supabase·RLS 사용 가능 */
  serverEnabled: boolean;
  onOpenGuide?: () => void;
}

const RADIUS_M = 900;

export function ViNeighborSendSheet({
  open,
  onClose,
  anchorLatLng,
  myUserId,
  serverEnabled,
  onOpenGuide,
}: ViNeighborSendSheetProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [pickId, setPickId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const canSend = useMemo(() => {
    const t = body.trim();
    return pickId && t.length >= 4 && t.length <= 300 && !!myUserId && serverEnabled;
  }, [body, pickId, myUserId, serverEnabled]);

  const loadRecipients = useCallback(async () => {
    if (!open || !anchorLatLng || !myUserId || !serverEnabled || !isSupabaseConfigured()) {
      setRecipients([]);
      setPickId(null);
      return;
    }
    setLoading(true);
    try {
      const sb = getSupabase();
      if (!sb) {
        setRecipients([]);
        return;
      }
      const { data, error } = await sb
        .from('profiles')
        .select('id, explore_lat, explore_lng')
        .eq('vi_neighbor_tips_opt_in', true)
        .neq('id', myUserId)
        .not('explore_lat', 'is', null)
        .not('explore_lng', 'is', null);
      if (error) throw error;
      const rows = (data ?? []) as { id: string; explore_lat: number; explore_lng: number }[];
      const withDist: Recipient[] = rows
        .map((r) => ({
          id: r.id,
          distM: haversineMeters(anchorLatLng, { lat: r.explore_lat, lng: r.explore_lng }),
        }))
        .filter((r) => r.distM <= RADIUS_M && Number.isFinite(r.distM))
        .sort((a, b) => a.distM - b.distM);
      setRecipients(withDist);
      setPickId(withDist[0]?.id ?? null);
    } catch (e) {
      console.warn('[ViNeighborSendSheet]', e);
      toast.error('수신 가능한 이웃 목록을 불러오지 못했어요.');
      setRecipients([]);
      setPickId(null);
    } finally {
      setLoading(false);
    }
  }, [open, anchorLatLng, myUserId, serverEnabled]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  const send = async () => {
    if (!canSend || !pickId || !myUserId || !anchorLatLng) return;
    const sb = getSupabase();
    if (!sb) return;
    setSending(true);
    try {
      const { error } = await sb.from('vi_neighbor_help_messages').insert({
        recipient_id: pickId,
        sender_id: myUserId,
        body: body.trim(),
        sender_lat: anchorLatLng.lat,
        sender_lng: anchorLatLng.lng,
      });
      if (error) throw error;
      toast.success('메시지를 보냈어요. 상대 앱에서 음성으로 안내돼요.');
      setBody('');
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '전송 실패';
      toast.error(msg.includes('rate limit') ? '같은 분에게는 잠시 후 다시 보내 주세요.' : msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="vi-send-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[605] bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="vi-send-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[606] max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[#0e0e14]/98 shadow-[0_-20px_60px_rgba(0,0,0,0.55)]"
            style={{ paddingBottom: 'calc(5.5rem + 0.75rem)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <button type="button" onClick={onClose} className="h-3 w-14" aria-label="닫기">
                <span className="block h-1 w-full rounded-full bg-white/20" />
              </button>
            </div>

            <div className="px-5 pt-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[17px] font-black text-white">시각장애인 이웃 도움</p>
                  <p className="mt-1 text-[12px] text-white/45 leading-relaxed">
                    짧은 안내는 음성으로 전달돼요. 장난·욕설은 제재됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/45"
                  aria-label="닫기"
                >
                  <X size={18} />
                </button>
              </div>

              {onOpenGuide && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenGuide();
                    onClose();
                  }}
                  className="mb-4 flex w-full items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-left text-[12px] font-semibold text-sky-200/95"
                >
                  <Info size={16} className="shrink-0 opacity-80" />
                  특별 마커·구청 승인 안내 보기
                </button>
              )}

              {!(serverEnabled && isSupabaseConfigured()) ? null : loading ? (
                <p className="text-[13px] text-white/50">수신 동의한 이웃 찾는 중…</p>
              ) : recipients.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-white/50">
                  반경 {RADIUS_M}m 안에 <b className="text-white/70">이웃 도움 음성 수신</b>을 켠 사용자가 없어요.
                  다른 기기에서 마이페이지에서 수신을 켜고, 지도에서 위치가 공유되는지 확인해 주세요.
                </p>
              ) : (
                <>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/35">
                    받는 분 (가까운 순)
                  </label>
                  <select
                    value={pickId ?? ''}
                    onChange={(e) => setPickId(e.target.value || null)}
                    className="mb-4 w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-[13px] text-white"
                  >
                    {recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        약 {Math.round(r.distM)}m — {r.id.slice(0, 8)}…
                      </option>
                    ))}
                  </select>

                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-white/35">
                    메시지 (4~300자)
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    maxLength={300}
                    placeholder="예: 앞 공사, 우회"
                    className="mb-3 w-full resize-none rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-[14px] text-white placeholder:text-white/25"
                  />
                  <p className="mb-4 text-[11px] text-white/30">같은 분에게 1시간에 최대 6통까지 보낼 수 있어요.</p>

                  <button
                    type="button"
                    disabled={!canSend || sending}
                    onClick={() => void send()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 py-3.5 text-[15px] font-bold text-white transition-opacity disabled:opacity-35"
                  >
                    <Send size={18} />
                    {sending ? '보내는 중…' : '조용히 보내기'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
