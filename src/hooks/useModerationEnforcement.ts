import { useEffect } from 'react';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabaseClient';

/**
 * 이메일 재가입 차단·AI/관리자 이용 제한 시 즉시 로그아웃.
 */
export function useModerationEnforcement(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const sb = getSupabase();
      if (!sb || cancelled) return;

      const { data: emailBanned, error: rpcErr } = await sb.rpc('check_my_email_banned');
      if (cancelled) return;
      if (rpcErr) {
        console.warn('[moderation] check_my_email_banned', rpcErr.message);
      } else if (emailBanned === true) {
        toast.error('이 이메일은 재가입이 제한된 계정이에요.');
        await sb.auth.signOut();
        return;
      }

      const { data: row } = await sb.from('user_moderation').select('status').eq('user_id', userId).maybeSingle();
      if (cancelled) return;
      const s = row?.status as string | undefined;
      if (s === 'suspended_ai') {
        toast.error(
          'AI가 부적절한 SOS 이용(홍보·음란 등)으로 판단했어요. 관리자 검토 전까지 로그인이 제한됩니다.',
        );
        await sb.auth.signOut();
        return;
      }
      if (s === 'suspended_reports') {
        toast.error(
          '이용자 신고가 여러 건 접수되어 계정이 일시 제한됐어요. 관리자 검토 후 해제·조치됩니다.',
        );
        await sb.auth.signOut();
        return;
      }
      if (s === 'suspended_admin') {
        toast.error('관리자 조치로 계정이 일시 제한되었어요. 문의가 필요하면 고객센터로 연락해 주세요.');
        await sb.auth.signOut();
        return;
      }
      if (s === 'banned') {
        toast.error('이용이 영구 제한된 계정이에요.');
        await sb.auth.signOut();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
