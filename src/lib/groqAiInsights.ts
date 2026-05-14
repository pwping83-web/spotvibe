import type { MoodImageKey } from '@/app/constants/spotMoodImages';
import type { AiInsightUiBucket } from '@/app/constants/exploreRegions';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const MOOD_KEYS: MoodImageKey[] = [
  'busking',
  'hanRiver',
  'retailCrowd',
  'nightlife',
  'outdoorActive',
  'foodFest',
  'mapoHangangPark',
];

export type AiInsightProfilePayload = {
  ageRange: string;
  gender: string;
  mbti: string[];
  bloodTypes: string[];
  activityTags: string[];
  genderPref: string;
  ageRangeMatchSet: string[];
  notificationTimeSlots: string[];
  notificationWeekdays: number[];
};

export type GroqInsightCard = {
  id: number;
  title: string;
  desc: string;
  time: string;
  accent: string;
  group: 'today' | 'yesterday' | 'earlier';
  isNew?: boolean;
  moodKey: MoodImageKey;
};

function parseJsonArray(content: string): unknown[] | null {
  let t = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) t = fence[1]!.trim();
  try {
    const v = JSON.parse(t);
    return Array.isArray(v) ? v : null;
  } catch {
    const m = /\[[\s\S]*\]/.exec(t);
    if (!m) return null;
    try {
      const v = JSON.parse(m[0]);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  }
}

function normalizeMoodKey(v: unknown): MoodImageKey {
  const s = typeof v === 'string' ? v.trim() : '';
  if (MOOD_KEYS.includes(s as MoodImageKey)) return s as MoodImageKey;
  return 'hanRiver';
}

function normalizeGroup(v: unknown): 'today' | 'yesterday' | 'earlier' {
  if (v === 'today' || v === 'yesterday' || v === 'earlier') return v;
  return 'today';
}

function normalizeAccent(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  return '#00F0FF';
}

/**
 * 마이 프로필·권역을 바탕으로 알림 탭용 AI 인사이트 카드 문구를 Groq에서 생성합니다.
 * 실제 인파 측정이 아닌 참고용 가상 시나리오임을 모델에 명시합니다.
 */
export async function fetchGroqInsightNotifications(
  apiKey: string,
  input: {
    profile: AiInsightProfilePayload;
    metroLabel: string;
    regionBucket: AiInsightUiBucket;
  },
  signal?: AbortSignal,
): Promise<GroqInsightCard[]> {
  const { profile, metroLabel, regionBucket } = input;
  const userJson = JSON.stringify(profile, null, 0);

  const system = `당신은 한국어 앱 SpotVibe의 카피라이터입니다. 응답은 JSON만 출력합니다.
규칙:
- 실제 GPS나 인구 통계를 모른다고 가정하고, **가상의 익명 집계 시나리오**로 재미·영감 있는 한국어 카피를 씁니다.
- 과장·허위 사실 단정 금지. "~로 보인다", "집계 패턴상" 등 완곡한 표현 사용.
- 배열 길이 정확히 6. 각 원소: {"title","desc","time","accent","group","isNew","moodKey"}
- title: 28자 이내, desc: 90자 이내, time: "방금 전"|"23분 전"|"1시간 전"|"어제 오후 6시"|"2일 전" 등 짧게
- accent: #RRGGBB 형식 6자리
- group: "today"|"yesterday"|"earlier" — 각 2개씩 분배
- isNew: boolean — today 중 2개만 true
- moodKey는 반드시 다음 중 하나만: busking, hanRiver, retailCrowd, nightlife, outdoorActive, foodFest, mapoHangangPark`;

  const user = `권역 라벨: ${metroLabel}
권역 버킷 코드: ${regionBucket}
마이 프로필(JSON): ${userJson}

위 조건에 맞춰 이 권역에서 갈 만한 장소·분위기 타입의 **가상 인사이트 카드 6개**를 JSON 배열로만 출력하세요.`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.65,
      max_tokens: 1800,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Groq HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') throw new Error('Groq 응답에 본문이 없어요.');

  const arr = parseJsonArray(content);
  if (!arr || arr.length === 0) throw new Error('JSON 배열 파싱 실패');

  const out: GroqInsightCard[] = [];
  let i = 0;
  for (const row of arr.slice(0, 8)) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 80) : '';
    const desc = typeof o.desc === 'string' ? o.desc.trim().slice(0, 200) : '';
    if (!title || !desc) continue;
    out.push({
      id: 9000 + i,
      title,
      desc,
      time: typeof o.time === 'string' && o.time.trim() ? o.time.trim().slice(0, 24) : '방금 전',
      accent: normalizeAccent(o.accent),
      group: normalizeGroup(o.group),
      isNew: Boolean(o.isNew),
      moodKey: normalizeMoodKey(o.moodKey),
    });
    i += 1;
    if (out.length >= 6) break;
  }

  if (out.length === 0) throw new Error('유효한 카드가 없어요.');
  return out;
}
