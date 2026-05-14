/**
 * 휴대폰 본인확인(다날·KCP·PASS 등) 성공 후 Supabase가 받는 콜백 스켈레톤.
 *
 * 운영 전 필수:
 * 1) 인증 업체와 콜백 URL·파라미터·서명 검증 방식 확정
 * 2) 아래 TODO에 업체 응답 검증 + userId 매핑 구현
 * 3) Supabase Secrets: PHONE_CERT_WEBHOOK_SECRET(임의 강한 문자열), SUPABASE_* 기본값
 *
 * 임시 테스트(로컬/스테이징): POST + 헤더 X-SpotVibe-Cert-Secret + JSON { "userId": "<uuid>", "vendor": "danal" }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('PHONE_CERT_WEBHOOK_SECRET') ?? '';

function cors(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-spotvibe-cert-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const hdr = req.headers.get('x-spotvibe-cert-secret') ?? '';
  if (!WEBHOOK_SECRET || hdr !== WEBHOOK_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: { userId?: string; vendor?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const userId = body.userId?.trim();
  const vendor = (body.vendor ?? 'unknown').trim().slice(0, 32);
  if (!userId) return json({ error: 'userId_required' }, 400);

  // TODO: 업체 원문(body/query) 서명·금액·tid 검증 후에만 아래 RPC 호출
  // TODO: userId는 업체 세션과 매핑된 Supabase auth.users.id 와 일치하는지 검증

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.rpc('mark_profile_certified', {
    p_user_id: userId,
    p_vendor: vendor,
  });

  if (error) {
    console.error('[phone-cert-callback]', error.message);
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, result: data });
});
