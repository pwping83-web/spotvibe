import { useEffect, useRef } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { speakViNeighborMessage } from '@/lib/viSpeech';
import { toast } from 'sonner';

export interface UseViNeighborHelpMessagesOptions {
  userId: string | null;
  /** 수신 동의 + 로그인 시에만 구독 */
  optIn: boolean;
  /** 관리자 테스트 지도 등에서 서버 비활성 시 끔 */
  serverEnabled: boolean;
}

/**
 * 시각장애인 이웃 도움 메시지 INSERT 구독 → 음성 안내
 */
export function useViNeighborHelpMessages({
  userId,
  optIn,
  serverEnabled,
}: UseViNeighborHelpMessagesOptions) {
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !userId || !optIn || !serverEnabled) return;
    const sb = getSupabase();
    if (!sb) return;

    const channel = sb
      .channel(`vi-neighbor-help:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vi_neighbor_help_messages',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; body?: string };
          if (!row?.id || !row?.body) return;
          if (lastIdRef.current === row.id) return;
          lastIdRef.current = row.id;
          const line = `이웃 도움 메시지입니다. ${row.body}`;
          speakViNeighborMessage(line);
          toast.message('이웃 도움 메시지', { description: row.body, duration: 12_000 });
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [userId, optIn, serverEnabled]);
}
