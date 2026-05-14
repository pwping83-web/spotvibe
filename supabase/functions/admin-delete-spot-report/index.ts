/**
 * 관리자 전용: spot_reports 행 + spot-photos Storage 객체를 즉시 삭제.
 * 부적절·불법 콘텐츠 등 비상 모더레이션용.
 * Secrets: ADMIN_SPOT_REPORT_EMAIL (기본 pwping83@gmail.com)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

/** public / signed URL 모두에서 bucket 다음 경로(userId/파일명) 추출 */
function spotPhotosObjectPathFromUrl(photoUrl: string): string | null {
  try {
    const u = new URL(photoUrl);
    const needle = '/spot-photos/';
    const i = u.pathname.indexOf(needle);
    if (i === -1) return null;
    const raw = u.pathname.slice(i + needle.length).replace(/^\/+/, '');
    if (!raw) return null;
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return jsonRes({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const adminEmail = (Deno.env.get('ADMIN_SPOT_REPORT_EMAIL') ?? 'pwping83@gmail.com').toLowerCase();

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonRes({ ok: false, error: 'server_misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonRes({ ok: false, error: 'no_auth' }, 401);
  }

  let body: { reportId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonRes({ ok: false, error: 'invalid_json' }, 400);
  }
  const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';
  if (!reportId) {
    return jsonRes({ ok: false, error: 'report_id_required' }, 400);
  }

  const sbUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await sbUser.auth.getUser();
  if (userErr || !user?.id || !user.email) {
    return jsonRes({ ok: false, error: 'not_authenticated' }, 401);
  }
  if (user.email.toLowerCase() !== adminEmail) {
    return jsonRes({ ok: false, error: 'forbidden' }, 403);
  }

  const sb = createClient(supabaseUrl, serviceKey);
  const { data: row, error: fetchErr } = await sb
    .from('spot_reports')
    .select('id, photo_url')
    .eq('id', reportId)
    .maybeSingle();

  if (fetchErr || !row) {
    return jsonRes({ ok: false, error: 'not_found' }, 404);
  }

  const photoUrl = String(row.photo_url ?? '');
  const objectPath = spotPhotosObjectPathFromUrl(photoUrl);

  if (objectPath) {
    const { error: rmErr } = await sb.storage.from('spot-photos').remove([objectPath]);
    if (rmErr) {
      console.error('admin-delete-spot-report storage.remove:', rmErr);
      /* Storage 실패해도 DB는 지워 피드·지도에서 즉시 제거 */
    }
  } else {
    console.warn('admin-delete-spot-report: could not parse storage path from', photoUrl.slice(0, 120));
  }

  const { data: deletedRows, error: delErr } = await sb.from('spot_reports').delete().eq('id', reportId).select('id');
  if (delErr) {
    console.error('admin-delete-spot-report spot_reports.delete:', delErr);
    return jsonRes({ ok: false, error: 'delete_failed', detail: delErr.message }, 500);
  }
  if (!deletedRows?.length) {
    return jsonRes({ ok: false, error: 'not_found_after_storage' }, 404);
  }

  return jsonRes({ ok: true, deleted: true });
});
