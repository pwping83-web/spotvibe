/**
 * 현장 제보 제목·설명 / SOS 메모 텍스트 — Groq로 allow | held | block (spot) 또는 allow | block (sos_note).
 * Secrets: GROQ_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY (JWT 검증)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = 'llama-3.1-8b-instant';

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
    return jsonRes(
      { ok: false, error: 'method_not_allowed', reason: '허용되지 않은 요청이에요.' },
      405,
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const groqKey = Deno.env.get('GROQ_API_KEY') ?? '';
  if (!groqKey) {
    return jsonRes(
      {
        ok: false,
        error: 'missing_groq',
        reason:
          'AI 검토용 GROQ_API_KEY가 Edge Secrets에 없어요. Supabase 대시보드에서 추가한 뒤 함수를 다시 배포해 주세요.',
      },
      503,
    );
  }
  if (!supabaseUrl || !anonKey) {
    return jsonRes(
      {
        ok: false,
        error: 'server_misconfigured',
        reason: '서버(Supabase URL·Anon 키) 설정이 비어 있어요.',
      },
      500,
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonRes(
      { ok: false, error: 'no_auth', reason: '로그인 토큰이 없어요. 다시 로그인해 주세요.' },
      401,
    );
  }
  const sbUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await sbUser.auth.getUser();
  if (authErr || !user?.id) {
    return jsonRes(
      {
        ok: false,
        error: 'not_authenticated',
        reason: '로그인 확인에 실패했어요. 다시 로그인해 주세요.',
      },
      401,
    );
  }

  let body: {
    context?: string;
    placeTitle?: string;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonRes(
      { ok: false, error: 'invalid_json', reason: '요청 본문을 읽을 수 없어요.' },
      400,
    );
  }

  const context = body.context === 'sos_note' ? 'sos_note' : 'spot_report';
  const placeTitle = typeof body.placeTitle === 'string' ? body.placeTitle.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const combined = [placeTitle, description].filter(Boolean).join('\n');

  if (combined.length < 1) {
    return jsonRes({
      ok: true,
      decision: 'allow',
      reason: '빈 텍스트',
    });
  }
  if (combined.length > 4000) {
    return jsonRes(
      {
        ok: false,
        error: 'text_too_long',
        reason: '텍스트가 너무 길어요. 4천 자 이내로 줄여 주세요.',
      },
      413,
    );
  }

  const systemSpot =
    `You moderate Korean text for SpotVibe "live street photo" reports (map app). Return ONLY JSON.

decision:
- "allow" — normal public event / place / street scene description.
- "held" — suspicious shop promo unrelated to live event, mild sexual subtext, ambiguous scam/spam, needs human review (user may save but NOT public until admin).
- "block" — explicit sexual solicitation, how-to crime, drug dealing, extreme slurs, CSAM references, terrorism instructions — must NOT post.

Title and description may be short. Be strict on block, cautious on held.

JSON only: {"decision":"allow"|"held"|"block","reason":"Korean one short sentence"}`;

  const systemSos =
    `You moderate Korean SOS emergency note text for SpotVibe neighbor-help (NOT replacing 119/112). Return ONLY JSON.

decision:
- "allow" — plausible emergency or location note.
- "block" — sexual solicitation, commercial spam unrelated to emergency, crime facilitation, hate — must NOT send.

NO "held" for SOS — only allow or block (emergency should not wait on text review).

JSON only: {"decision":"allow"|"block","reason":"Korean one short sentence"}`;

  const userMsg =
    context === 'sos_note'
      ? `SOS situation note:\n${description || placeTitle}`
      : `Report title: ${placeTitle || '(없음)'}\nDescription: ${description || '(없음)'}`;

  const groqRes = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      temperature: 0.1,
      max_tokens: 200,
      messages: [
        { role: 'system', content: context === 'sos_note' ? systemSos : systemSpot },
        { role: 'user', content: userMsg },
      ],
    }),
  });

  if (!groqRes.ok) {
    const t = await groqRes.text();
    console.error('Groq text mod:', groqRes.status, t.slice(0, 400));
    return jsonRes(
      {
        ok: false,
        error: 'groq_failed',
        reason:
          'AI 텍스트 검토에 실패했어요. GROQ_API_KEY와 네트워크를 확인한 뒤 잠시 후 다시 시도해 주세요.',
      },
      502,
    );
  }

  const groqJson = (await groqRes.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = groqJson.choices?.[0]?.message?.content?.trim() ?? '';
  const parsed = parseModelJson(raw);
  if (!parsed || typeof parsed.decision !== 'string') {
    console.error('Groq text mod parse:', raw.slice(0, 400));
    return jsonRes(
      {
        ok: false,
        error: 'groq_parse',
        reason: 'AI 검토 결과를 해석하지 못했어요. 문장을 조금 바꿔 다시 시도해 주세요.',
      },
      502,
    );
  }

  let decision = String(parsed.decision).toLowerCase();
  const reason = String(parsed.reason ?? '').slice(0, 400).trim() || 'AI 검토';

  if (context === 'sos_note') {
    if (decision !== 'allow' && decision !== 'block') decision = 'allow';
  } else {
    if (!['allow', 'held', 'block'].includes(decision)) decision = 'held';
  }

  return jsonRes({
    ok: true,
    decision,
    reason,
    context,
  });
});
