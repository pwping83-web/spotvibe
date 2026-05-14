/**
 * 관리자·파일 제보: Groq 비전으로 pending → verified | rejected (service role).
 * Secrets: GROQ_API_KEY, 선택 ADMIN_SPOT_REPORT_EMAIL (기본 pwping83@gmail.com)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

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

function parseModelJson(content: string): Record<string, unknown> | null {
  let t = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) t = fence[1]!.trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    const m = /\{[\s\S]*\}/.exec(t);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
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
  const groqKey = Deno.env.get('GROQ_API_KEY') ?? '';
  const adminEmail = (Deno.env.get('ADMIN_SPOT_REPORT_EMAIL') ?? 'pwping83@gmail.com').toLowerCase();

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonRes({ ok: false, error: 'server_misconfigured' }, 500);
  }
  if (!groqKey) {
    return jsonRes({ ok: false, error: 'missing_groq' }, 503);
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
    .select('id,user_id,status,photo_url,place_name,description')
    .eq('id', reportId)
    .maybeSingle();

  if (fetchErr || !row) {
    return jsonRes({ ok: false, error: 'not_found' }, 404);
  }
  if (row.user_id !== user.id) {
    return jsonRes({ ok: false, error: 'not_owner' }, 403);
  }
  if (row.status !== 'pending') {
    return jsonRes({ ok: false, error: 'wrong_status', status: row.status }, 400);
  }

  const placeTitle = String(row.place_name ?? '').trim();
  if (!placeTitle) {
    const { data: rej, error: rejErr } = await sb
      .from('spot_reports')
      .update({
        status: 'rejected',
        ai_label: null,
        ai_category: 'other',
        ai_reason: '장소 이름(제목)이 필요해요.',
      })
      .eq('id', reportId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (rejErr || !rej) {
      console.error('spot_reports reject (no title):', rejErr);
      return jsonRes({ ok: false, error: 'update_failed' }, 500);
    }
    return jsonRes({
      ok: true,
      verified: false,
      rejected: true,
      label: '',
      category: 'other',
      reason: '장소 이름(제목)이 필요해요.',
    });
  }

  const { data: textBlocked, error: textBlockedErr } = await sb.rpc('spot_reports_text_is_blocked', {
    p_place: placeTitle,
    p_desc: String(row.description ?? ''),
  });
  if (textBlockedErr) {
    console.error('spot_reports_text_is_blocked rpc:', textBlockedErr);
  }
  if (!textBlockedErr && textBlocked === true) {
    const { data: rej2, error: rej2Err } = await sb
      .from('spot_reports')
      .update({
        status: 'rejected',
        ai_label: null,
        ai_category: 'other',
        ai_reason: '제목·설명에 부적절한 표현이 포함됐어요.',
      })
      .eq('id', reportId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (rej2Err || !rej2) {
      console.error('spot_reports reject (blocked text):', rej2Err);
      return jsonRes({ ok: false, error: 'update_failed' }, 500);
    }
    return jsonRes({
      ok: true,
      verified: false,
      rejected: true,
      label: '',
      category: 'other',
      reason: '제목·설명에 부적절한 표현이 포함됐어요.',
    });
  }

  const imgRes = await fetch(row.photo_url as string);
  if (!imgRes.ok) {
    return jsonRes({ ok: false, error: 'photo_fetch_failed' }, 502);
  }

  const system = `You judge ONE photo for a Korean app "SpotVibe" live street/event reports.

Approve ONLY if the image is clearly a real OUTDOOR or clearly PUBLIC venue scene (busking, market, crowd, festival, park/plaza activity, street food stall, subway station concourse, mall atrium with public event, etc.).

ALWAYS reject (approve=false):
- Indoor PRIVATE or residential spaces: home living room, bedroom, bathroom, kitchen as a flat/house interior, apartment room, dorm room, selfie in home mirror, ceiling/lamp close-ups typical of indoors.
- Mostly indoor cafe/restaurant seating with no clear "현장 이벤트" or street context (cozy interior-only shots).
- Stock photos, screenshots, memes, documents, unrelated objects, mostly blank, obvious non-scene, AI-looking fake scene.

If the scene is ambiguous but leans residential/private indoor → reject.

Reply with ONLY JSON (no markdown): {"approve":boolean,"label":"Korean short title max 40 chars","category":"performance|market|crowd|other","reason":"one Korean sentence"}`;

  const hint = `사용자가 적은 장소 이름: "${placeTitle}". 설명: ${(row.description as string | null)?.trim() || '(없음)'}`;

  const groqRes = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0.15,
      max_tokens: 400,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: hint },
            { type: 'image_url', image_url: { url: row.photo_url as string } },
          ],
        },
      ],
    }),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error('Groq error:', groqRes.status, errText);
    return jsonRes({ ok: false, error: 'groq_failed', detail: errText.slice(0, 200) }, 502);
  }

  const groqJson = (await groqRes.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawContent = groqJson.choices?.[0]?.message?.content?.trim() ?? '';
  const parsed = parseModelJson(rawContent);
  if (!parsed || typeof parsed.approve !== 'boolean') {
    console.error('Groq parse fail:', rawContent.slice(0, 500));
    return jsonRes({ ok: false, error: 'groq_parse' }, 502);
  }

  const approve = parsed.approve === true;
  const label = String(parsed.label ?? '현장 제보').slice(0, 80);
  let category = String(parsed.category ?? 'other').toLowerCase();
  if (!['performance', 'market', 'crowd', 'other'].includes(category)) category = 'other';
  const reason = String(parsed.reason ?? (approve ? 'AI 판독 통과' : 'AI 판독 반려')).slice(0, 300);

  const { data: updated, error: updErr } = await sb
    .from('spot_reports')
    .update({
      status: approve ? 'verified' : 'rejected',
      ai_label: label,
      ai_category: category,
      ai_reason: reason,
    })
    .eq('id', reportId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (updErr || !updated) {
    console.error('spot_reports update:', updErr);
    return jsonRes({ ok: false, error: 'update_failed' }, 500);
  }

  return jsonRes({
    ok: true,
    verified: approve,
    rejected: !approve,
    label,
    category,
    reason,
  });
});
