/**
 * SOS 발신 전: 선택 유형과 사진 내용 일치 + 홍보·음란 등 부정 이용 탐지.
 * 부정 이용 시 user_moderation(suspended_ai) 기록 — Secrets: GROQ_API_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Groq 비전: https://console.groq.com/docs/vision — Secrets에 GROQ_API_KEY 필수 */
const DEFAULT_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
/** Groq 문서: base64 이미지 약 4MB 상한 */
const MAX_BASE64_CHARS = 4 * 1024 * 1024;

const SOS_TYPES = ['fire', 'public_safety', 'missing', 'medical'] as const;

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

/**
 * 클라이언트: EXIF 촬영 시각·스크린샷 Software 태그 1차 검사.
 * 여기서: 모니터/브라우저 재촬영·구글 이미지 그리드 등 2차 탐지.
 */
function systemPrompt(signalType: string): string {
  const common =
    `SpotVibe 이웃 도움 SOS(한국). 반드시 JSON만, 마크다운 금지.
정책: 허위·재촬영·의심 사진이 올라오는 것보다 거절하는 편이 맞다. **모호하면 approve=false** (reason에 한국어로 왜 의심되는지). abuse 는 명백할 때만 true.

approve=true 는 “실제 카메라로 찍은 현장”이 거의 확실할 때만. 스톡·웹 이미지 느낌, 과하게 깨끗한 상업 사진, 화면을 찍은 듯한 질감이면 거절.

abuse=true (approve=false) 인 명백한 경우:
- 노트북·모니터·TV를 재촬영(베젤, 모아레, 창·탭·주소줄·브라우저 UI).
- 구글 이미지 격자, 지도/유튜브 UI가 보이는 재촬영.
- 다른 폰 화면만 클로즈업.
- 메뉴판·전단·쇼핑몰 캡처, 성적·성매매, 밈·무관 광고.

abuse=false 이지만 approve=false: 의심스럽거나 현장 확신 불가.

JSON 키만: {"approve":boolean,"summary":"한국어 90자 이내","reason":"한국어 한 문장","abuse":boolean,"abuse_kind":"promo"|"sexual"|"spam"|"other"|null}`;

  const typeHint: Record<string, string> = {
    fire: '참고 유형: 화재. 연기·불·현장이 확실하면 통과. 애매한 하늘·벽만 있으면 거절.',
    public_safety: '참고 유형: 치안. 실제 공공장소·사람·차량 등이 보이면 통과. 애매하면 거절.',
    missing: '참고 유형: 조난. 야외 길·지형 등 이동 공간이 보이면 통과. 애매하면 거절.',
    medical: '참고 유형: 구급. 병원·응급·사람·실내 복도 등 현장이 보이면 통과. 애매하면 거절.',
  };

  return `${common}\n${typeHint[signalType] ?? typeHint.public_safety}`;
}

function isAbusiveContent(parsed: Record<string, unknown>): boolean {
  if (parsed.abuse === true) return true;
  const k = String(parsed.abuse_kind ?? '').toLowerCase();
  return ['promo', 'sexual', 'spam', 'commercial', 'promo_spam'].includes(k);
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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const groqKey = Deno.env.get('GROQ_API_KEY') ?? '';

  if (!supabaseUrl || !anonKey) {
    return jsonRes(
      {
        ok: false,
        error: 'server_misconfigured',
        reason: '서버(Supabase URL/키) 설정이 비어 있어요. 배포 설정을 확인해 주세요.',
      },
      500,
    );
  }
  if (!groqKey) {
    return jsonRes(
      {
        ok: false,
        error: 'missing_groq',
        reason:
          'AI 검토용 GROQ_API_KEY가 Edge Secrets에 없어요. Supabase 대시보드 → Edge Functions → Secrets에서 추가해 주세요.',
      },
      503,
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonRes(
      { ok: false, error: 'no_auth', reason: '로그인 토큰이 없어요. 다시 로그인한 뒤 시도해 주세요.' },
      401,
    );
  }

  let body: { signalType?: string; imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return jsonRes(
      { ok: false, error: 'invalid_json', reason: '요청 본문을 읽을 수 없어요. 앱을 다시 열어 주세요.' },
      400,
    );
  }

  const signalType = typeof body.signalType === 'string' ? body.signalType.trim() : '';
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  const mimeType = typeof body.mimeType === 'string' && body.mimeType.includes('/')
    ? body.mimeType.trim()
    : 'image/jpeg';

  if (!SOS_TYPES.includes(signalType as (typeof SOS_TYPES)[number])) {
    return jsonRes({ ok: false, error: 'bad_signal_type', reason: 'SOS 유형이 올바르지 않아요. 앱을 업데이트했는지 확인해 주세요.' }, 400);
  }
  if (!imageBase64 || imageBase64.length < 80) {
    return jsonRes({ ok: false, error: 'image_required', reason: '사진 데이터가 비어 있어요. 다른 사진을 선택해 주세요.' }, 400);
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return jsonRes(
      {
        ok: false,
        error: 'payload_too_large',
        reason: '사진이 AI 분석 한도(용량)를 넘어요. 더 작게 찍거나 자르기 후 다시 시도해 주세요.',
      },
      413,
    );
  }

  const sbUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await sbUser.auth.getUser();
  if (userErr || !user?.id) {
    return jsonRes(
      {
        ok: false,
        error: 'not_authenticated',
        reason: '로그인 확인에 실패했어요. 다시 로그인한 뒤 시도해 주세요.',
      },
      401,
    );
  }

  const dataUrl = mimeType.startsWith('image/')
    ? `data:${mimeType};base64,${imageBase64}`
    : `data:image/jpeg;base64,${imageBase64}`;

  const visionModel = Deno.env.get('GROQ_VISION_MODEL')?.trim() || DEFAULT_VISION_MODEL;

  const groqRes = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: visionModel,
      temperature: 0.12,
      max_tokens: 480,
      messages: [
        { role: 'system', content: systemPrompt(signalType) },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `선택된 SOS 유형 코드: "${signalType}". 모호·재촬영·웹 이미지 의심이면 approve=false. 명백한 화면 재촬영·광고면 abuse=true.`,
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error('Groq SOS verify:', visionModel, groqRes.status, errText.slice(0, 500));
    try {
      const j = JSON.parse(errText) as { error?: { message?: string } };
      const m = j?.error?.message;
      if (typeof m === 'string' && m.trim()) console.error('Groq message:', m.trim().slice(0, 300));
    } catch {
      /* ignore */
    }
    return jsonRes(
      {
        ok: false,
        error: 'groq_failed',
        reason:
          'AI 사진 분석에 실패했어요. Supabase Edge Secrets의 GROQ_API_KEY·함수 배포 여부를 확인하고, 잠시 후 다시 시도해 주세요.',
      },
      502,
    );
  }

  const groqJson = (await groqRes.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawContent = groqJson.choices?.[0]?.message?.content?.trim() ?? '';
  const parsed = parseModelJson(rawContent);
  if (!parsed || typeof parsed.approve !== 'boolean') {
    console.error('Groq SOS parse fail:', rawContent.slice(0, 600));
    return jsonRes(
      {
        ok: false,
        error: 'groq_parse',
        reason:
          'AI가 사진 판독 결과를 올바른 형식으로 내지 않았어요. 밝기·초점을 바꾼 사진으로 다시 시도해 주세요.',
      },
      502,
    );
  }

  const approve = parsed.approve === true;
  const summary = String(parsed.summary ?? '').slice(0, 200).trim() || '현장 사진 확인됨';
  let reason = String(parsed.reason ?? '').slice(0, 320).trim();

  const abusive = isAbusiveContent(parsed);
  if (abusive && serviceKey) {
    const sbAdmin = createClient(supabaseUrl, serviceKey);
    const modReason =
      reason ||
      (parsed.abuse === true
        ? 'AI: 홍보·음란·스팸 등 부적절 SOS 의심'
        : 'AI: 선택 유형과 부합하지 않는 부적절 콘텐츠');
    const { error: modErr } = await sbAdmin.from('user_moderation').upsert(
      {
        user_id: user.id,
        status: 'suspended_ai',
        reason: modReason.slice(0, 500),
        source: 'ai_sos_photo',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (modErr) console.error('user_moderation upsert:', modErr);
    return jsonRes({
      ok: false,
      approve: false,
      abuse: true,
      reason:
        reason ||
        '홍보·음란 등 부적절한 이용으로 의심되어 접수되었어요. 관리자 검토 전까지 로그인이 제한될 수 있어요.',
    });
  }

  if (abusive && !serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing — cannot record moderation');
    return jsonRes({
      ok: false,
      approve: false,
      abuse: true,
      reason:
        reason ||
        '부적절한 콘텐츠로 의심됩니다. 관리자에게 문의해 주세요.',
    });
  }

  if (!approve) {
    return jsonRes({
      ok: false,
      approve: false,
      reason: reason || '선택한 신고 유형과 사진 내용이 맞지 않아요. 현장에 맞는 사진을 올려 주세요.',
    });
  }

  return jsonRes({
    ok: true,
    approve: true,
    summary,
    reason: reason || summary,
  });
});
