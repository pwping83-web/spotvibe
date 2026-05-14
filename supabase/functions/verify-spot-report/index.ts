/**
 * 레거시 호환: 클라이언트는 DB RPC `autoverify_own_spot_report`만 사용.
 * 이 함수는 여전히 배포돼 있으면 pending 제보를 verified로 올림(Groq·비전 없음).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface RequestBody {
  reportId: string;
  photoUrl?: string;
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, prefer, x-supabase-api-version, x-supabase-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const body: RequestBody = await req.json();
    const { reportId } = body;

    if (!reportId) {
      return jsonRes({ error: 'reportId is required' }, 400);
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    await sb
      .from('spot_reports')
      .update({
        status: 'verified',
        ai_label: '현장 제보',
        ai_category: 'other',
        ai_reason: 'Edge 자동 승인(AI 미사용)',
      })
      .eq('id', reportId)
      .eq('status', 'pending');

    return jsonRes({ verified: true, label: '현장 제보' });
  } catch (err) {
    console.error('verify-spot-report error:', err);
    return jsonRes({ error: String(err) }, 500);
  }
});
