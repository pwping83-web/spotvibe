import { getSupabase } from '@/lib/supabaseClient';

export type KakaoOAuthResult = 'oauth_redirect' | 'mock_ok' | 'missing_config';

function isAccessingViaLoopbackHost(): boolean {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

/**
 * OAuth 완료 후 브라우저가 돌아올 URL.
 * - 루프백(localhost/127): `.env`의 `VITE_AUTH_REDIRECT_URL`(예: `http://localhost:5199/`) — 폰·LAN IP 접속 시에는 env 미사용
 * - 그 외(LAN IP·배포 도메인): `origin + pathname(+search)` — `/`만이면 `/login`. Supabase는 허용 목록에 없는 `redirect_to`면
 *   Site URL로내므로, `http://IP:5199/` 단독보다 `http://IP:5199/login` 같이 경로가 있는 URL이 `/**` 패턴과 맞기 쉬움
 * - Redirect URLs: `http://192.168.x.x:5199/**` 등 (Supabase 문서: redirect_to는 URL Configuration과 일치해야 함)
 */
export function getAuthOAuthRedirectTo(): string {
  const fromEnv = import.meta.env.VITE_AUTH_REDIRECT_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim() && isAccessingViaLoopbackHost()) {
    const t = fromEnv.trim();
    return t.endsWith('/') ? t : `${t}/`;
  }
  if (!isAccessingViaLoopbackHost()) {
    const { origin, pathname, search } = window.location;
    const path = pathname && pathname !== '/' ? `${pathname}${search}` : '/login';
    return `${origin}${path}`;
  }
  return `${window.location.origin}/`;
}

/**
 * 카카오 OAuth 시작. 콜백 후 `getAuthOAuthRedirectTo()` URL로 복귀.
 * 로컬(dev)에서만 Supabase 없을 때 목업 로그인 — 배포(prod)에서는 missing_config 반환
 */
export async function signInWithKakaoOAuth(): Promise<KakaoOAuthResult> {
  const sb = getSupabase();
  if (!sb) {
    if (import.meta.env.PROD) return 'missing_config';
    await Promise.resolve();
    return 'mock_ok';
  }
  const redirectTo = getAuthOAuthRedirectTo();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo },
  });
  if (error) throw error;
  return 'oauth_redirect';
}
