/**
 * sync-public-notices — 공공 데이터 수집 Edge Function
 *
 * 역할:
 *   1. 행안부 긴급재난문자 V2 오픈API (safetydata.go.kr `/V2/api/DSSP-IF-00247`) → public_notices(source='disaster_sms')
 *   2. 공공데이터포털 지역 행사·안전 RSS 피드 → public_notices(source='rss')
 *   각 소스별로 sync_log에 수집 이력 기록.
 *
 * 호출 방법:
 *   - Supabase 대시보드 스케줄(pg_cron) 또는 관리자 페이지 수동 트리거
 *   - POST /functions/v1/sync-public-notices
 *   - Body: { "source": "all" | "disaster_sms" | "rss" }  (기본값: "all")
 *
 * Required Secrets (Supabase Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PUBLIC_DATA_API_KEY   ← 공공데이터포털 API 키 (data.go.kr)
 *   SAFETY_DATA_API_KEY   ← 행안부 안전데이터공유플랫폼 API 키 (safetydata.go.kr)
 *
 * 주의: 본 함수는 service_role로 DB 직접 접근 — 반드시 관리자/스케줄러만 호출.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ──────────────────────────────────────────
// 환경 변수
// ──────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SAFETY_API_KEY = Deno.env.get('SAFETY_DATA_API_KEY') ?? '';
const PUBLIC_API_KEY = Deno.env.get('PUBLIC_DATA_API_KEY') ?? '';
const ADMIN_EMAIL = 'pwping83@gmail.com';

// ──────────────────────────────────────────
// CORS 헬퍼
// ──────────────────────────────────────────
function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, prefer',
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

// ──────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────
interface NoticeRow {
  source: string;
  category: string;
  region_code?: string | null;
  region_name?: string | null;
  title: string;
  body?: string | null;
  external_url?: string | null;
  issued_at: string;   // ISO8601
  expires_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  sync_batch: string;
  raw_json?: unknown;
}

interface SyncResult {
  source: string;
  fetched: number;
  inserted: number;
  skipped: number;
  error?: string;
}

/** KST 기준 YYYYMMDD (요청변수 crtDt) */
function kstYYYYMMDD(d: Date): string {
  const s = d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
  return s.slice(0, 10).replace(/-/g, '');
}

/** CRT_DT 다양한 포맷 → ISO8601 (KST 오프셋) */
function parseCrtDtToIso(raw: string | undefined, fallbackIso: string): string {
  if (!raw || !raw.trim()) return fallbackIso;
  const t = raw.trim();
  const m14 = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(t);
  if (m14) {
    return `${m14[1]}-${m14[2]}-${m14[3]}T${m14[4]}:${m14[5]}:${m14[6]}+09:00`;
  }
  const m12 = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(t);
  if (m12) {
    return `${m12[1]}-${m12[2]}-${m12[3]}T${m12[4]}:${m12[5]}:00+09:00`;
  }
  const m8 = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m8) return `${m8[1]}-${m8[2]}-${m8[3]}T00:00:00+09:00`;
  const ms = Date.parse(t);
  if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  return fallbackIso;
}

type DisasterItem = {
  MSG_CN?: string;
  EMRG_STEP_NM?: string;
  RCPTN_RGN_NM?: string;
  CRT_DT?: string;
  DST_SE_NM?: string;
};

/** 공식 V2 JSON 응답에서 item 배열 추출 (래퍼 차이 흡수) */
function extractDisasterItems(json: unknown): DisasterItem[] {
  const root = json as Record<string, unknown>;
  const response = root?.response as Record<string, unknown> | undefined;
  const body = (response?.body ?? root?.body) as Record<string, unknown> | undefined;
  if (!body) return [];

  const itemsRaw = body.items;
  if (Array.isArray(itemsRaw)) {
    return itemsRaw as DisasterItem[];
  }
  if (itemsRaw && typeof itemsRaw === 'object') {
    const it = (itemsRaw as Record<string, unknown>).item;
    if (Array.isArray(it)) return it as DisasterItem[];
    if (it && typeof it === 'object') return [it as DisasterItem];
  }
  return [];
}

// ──────────────────────────────────────────
// 소스 1: 행안부 긴급재난문자 (공식 V2 오픈API)
// 상세: 행정안전부_긴급재난문자 → URL https://www.safetydata.go.kr/V2/api/DSSP-IF-00247
// (구 mps/brdcst/getBrdcstList.do 는 리다이렉트·폐기 가능 — 플랫폼 문의 게시판 301 이슈 참고)
// ──────────────────────────────────────────
async function fetchDisasterSms(batch: string): Promise<NoticeRow[]> {
  if (!SAFETY_API_KEY) {
    console.warn('[sync] SAFETY_DATA_API_KEY 미설정 — 재난문자 수집 건너뜀');
    return [];
  }

  const now = new Date();
  const fallbackIso = now.toISOString();
  // 조회시작일자 crtDt: 최근 3일치부터 (KST, YYYYMMDD) — 일자 단위만 지원
  const from = new Date(now.getTime() - 3 * 86_400_000);
  const crtDt = kstYYYYMMDD(from);

  const params = new URLSearchParams({
    serviceKey: SAFETY_API_KEY,
    pageNo: '1',
    numOfRows: '50',
    returnType: 'json',
    crtDt,
  });

  const url = `https://www.safetydata.go.kr/V2/api/DSSP-IF-00247?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`재난문자 API HTTP ${res.status}`);

  const json: unknown = await res.json();
  const items = extractDisasterItems(json);

  return items.map((item) => {
    const title = `[${item.DST_SE_NM ?? '재난'}] ${(item.MSG_CN ?? '').slice(0, 80)}`;
    const regionName = item.RCPTN_RGN_NM ?? null;
    const issued = parseCrtDtToIso(item.CRT_DT, fallbackIso);

    const cat = (() => {
      const t = (item.DST_SE_NM ?? '').toLowerCase();
      if (t.includes('화재')) return 'fire';
      if (t.includes('홍수') || t.includes('태풍') || t.includes('호우')) return 'flood';
      if (t.includes('지진')) return 'earthquake';
      return 'safety';
    })();

    return {
      source: 'disaster_sms',
      category: cat,
      region_name: regionName,
      title,
      body: item.MSG_CN ?? null,
      issued_at: issued,
      sync_batch: batch,
      raw_json: item,
    } satisfies NoticeRow;
  });
}

// ──────────────────────────────────────────
// 소스 2: 공공데이터포털 지역 문화행사 API
// API: https://apis.data.go.kr/B551011/KorService1/searchFestival1
// ──────────────────────────────────────────
async function fetchPublicEvents(batch: string): Promise<NoticeRow[]> {
  if (!PUBLIC_API_KEY) {
    console.warn('[sync] PUBLIC_DATA_API_KEY 미설정 — 지역행사 수집 건너뜀');
    return [];
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const params = new URLSearchParams({
    serviceKey: PUBLIC_API_KEY,
    numOfRows: '30',
    pageNo: '1',
    MobileOS: 'ETC',
    MobileApp: 'SpotVibe',
    _type: 'json',
    eventStartDate: today,
    arrange: 'A',  // 제목순
  });

  const url = `https://apis.data.go.kr/B551011/KorService1/searchFestival1?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`지역행사 API HTTP ${res.status}`);

  const json = await res.json() as {
    response?: {
      body?: {
        items?: {
          item?: Array<{
            title?: string;
            addr1?: string;
            eventstartdate?: string;
            eventenddate?: string;
            firstimage?: string;
            mapx?: string;
            mapy?: string;
            contentid?: string;
          }>;
        };
      };
    };
  };

  const items = json?.response?.body?.items?.item ?? [];

  return items.map((item) => {
    const startRaw = item.eventstartdate ?? '';
    const issued = startRaw.length === 8
      ? `${startRaw.slice(0, 4)}-${startRaw.slice(4, 6)}-${startRaw.slice(6, 8)}T00:00:00+09:00`
      : new Date().toISOString();

    const endRaw = item.eventenddate ?? '';
    const expires = endRaw.length === 8
      ? `${endRaw.slice(0, 4)}-${endRaw.slice(4, 6)}-${endRaw.slice(6, 8)}T23:59:59+09:00`
      : null;

    const lat = item.mapy ? parseFloat(item.mapy) : null;
    const lng = item.mapx ? parseFloat(item.mapx) : null;
    const externalUrl = item.contentid
      ? `https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=${item.contentid}`
      : null;

    return {
      source: 'rss',
      category: 'event',
      region_name: item.addr1 ?? null,
      title: item.title ?? '지역 행사',
      body: item.addr1 ?? null,
      external_url: externalUrl,
      issued_at: issued,
      expires_at: expires,
      lat: lat && !isNaN(lat) ? lat : null,
      lng: lng && !isNaN(lng) ? lng : null,
      sync_batch: batch,
      raw_json: item,
    } satisfies NoticeRow;
  });
}

// ──────────────────────────────────────────
// 소스 3: 서울시 공원 안전 공지 RSS
// 공원여가서비스 공공데이터 (parks.seoul.go.kr 시스템 RSS)
// ──────────────────────────────────────────
async function fetchParkSafetyRss(batch: string): Promise<NoticeRow[]> {
  // 서울 도시공원 현황 RSS (공개 엔드포인트)
  const url = 'https://parks.seoul.go.kr/template/sub/news/newsList.do?mStr=MzM&boardId=33&rss=true';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn('[sync] 공원 RSS HTTP', res.status, '— 건너뜀');
      return [];
    }
    const xml = await res.text();
    return parseRssToNotices(xml, 'rss', 'safety', '서울 도시공원', batch);
  } catch (e) {
    console.warn('[sync] 공원 RSS 실패:', e);
    return [];
  }
}

// ──────────────────────────────────────────
// RSS XML 파서 (Deno 기본 내장 없음 → 정규식으로 경량 파싱)
// ──────────────────────────────────────────
function parseRssToNotices(
  xml: string,
  source: string,
  category: string,
  regionName: string,
  batch: string,
): NoticeRow[] {
  const items: NoticeRow[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  const extractTag = (str: string, tag: string): string | null => {
    const m = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's').exec(str);
    return m ? m[1].trim() : null;
  };

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = extractTag(item, 'title') ?? '공지';
    const link = extractTag(item, 'link');
    const pubDateRaw = extractTag(item, 'pubDate');
    const description = extractTag(item, 'description');

    let issued: string;
    try {
      issued = pubDateRaw ? new Date(pubDateRaw).toISOString() : new Date().toISOString();
    } catch {
      issued = new Date().toISOString();
    }

    items.push({
      source,
      category,
      region_name: regionName,
      title,
      body: description?.replace(/<[^>]+>/g, '').slice(0, 300) ?? null,
      external_url: link,
      issued_at: issued,
      sync_batch: batch,
    });
  }

  return items;
}

// ──────────────────────────────────────────
// DB upsert (중복 무시)
// ──────────────────────────────────────────
async function upsertNotices(
  sb: ReturnType<typeof createClient>,
  notices: NoticeRow[],
  logId: string,
  source: string,
): Promise<SyncResult> {
  let inserted = 0;
  let skipped = 0;

  for (const notice of notices) {
    const { error } = await sb
      .from('public_notices')
      .upsert(notice, {
        onConflict: 'source,issued_at,title',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error('[sync] upsert error:', error.message, notice.title);
      skipped++;
    } else {
      inserted++;
    }
  }

  await sb
    .from('public_notices_sync_log')
    .update({
      finished_at: new Date().toISOString(),
      fetched_count: notices.length,
      inserted_count: inserted,
      skipped_count: skipped,
      status: 'ok',
    })
    .eq('id', logId);

  return { source, fetched: notices.length, inserted, skipped };
}

// ──────────────────────────────────────────
// 메인 핸들러
// ──────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return jsonRes({ ok: false, error: 'method_not_allowed' }, 405);
  }

  // 관리자 JWT 또는 service_role 인증 확인
  const authHeader = req.headers.get('authorization') ?? '';
  const isServiceRole = authHeader.includes(SERVICE_KEY);

  if (!isServiceRole) {
    // JWT에서 이메일 추출해 관리자 확인
    try {
      const token = authHeader.replace(/^Bearer\s+/, '');
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload?.email !== ADMIN_EMAIL && payload?.sub !== 'service_role') {
        return jsonRes({ ok: false, error: 'forbidden' }, 403);
      }
    } catch {
      return jsonRes({ ok: false, error: 'unauthorized' }, 401);
    }
  }

  let body: { source?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }
  const targetSource = body?.source ?? 'all';

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonRes({ ok: false, error: 'missing_env' }, 500);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const batch = new Date().toISOString();
  const results: SyncResult[] = [];

  // ── 재난문자 수집 ──
  if (targetSource === 'all' || targetSource === 'disaster_sms') {
    const { data: logRow } = await sb
      .from('public_notices_sync_log')
      .insert({ source: 'disaster_sms', status: 'running' })
      .select('id')
      .single();
    const logId = logRow?.id ?? '';

    try {
      const notices = await fetchDisasterSms(batch);
      const result = await upsertNotices(sb, notices, logId, 'disaster_sms');
      results.push(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from('public_notices_sync_log').update({
        finished_at: new Date().toISOString(),
        status: 'error',
        error_msg: msg,
      }).eq('id', logId);
      results.push({ source: 'disaster_sms', fetched: 0, inserted: 0, skipped: 0, error: msg });
    }
  }

  // ── 지역 문화행사 수집 ──
  if (targetSource === 'all' || targetSource === 'rss') {
    const { data: logRow } = await sb
      .from('public_notices_sync_log')
      .insert({ source: 'rss', status: 'running' })
      .select('id')
      .single();
    const logId = logRow?.id ?? '';

    try {
      const [eventNotices, parkNotices] = await Promise.all([
        fetchPublicEvents(batch),
        fetchParkSafetyRss(batch),
      ]);
      const all = [...eventNotices, ...parkNotices];
      const result = await upsertNotices(sb, all, logId, 'rss');
      results.push(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from('public_notices_sync_log').update({
        finished_at: new Date().toISOString(),
        status: 'error',
        error_msg: msg,
      }).eq('id', logId);
      results.push({ source: 'rss', fetched: 0, inserted: 0, skipped: 0, error: msg });
    }
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const hasError = results.some((r) => r.error);

  return jsonRes({
    ok: !hasError || totalInserted > 0,
    batch,
    results,
    summary: `${totalInserted}건 신규 수집`,
  });
});
