import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    typeof url === 'string' &&
      url.trim() &&
      typeof anonKey === 'string' &&
      anonKey.trim(),
  );
}

let client: SupabaseClient | null = null;

/** 환경 변수가 없으면 `null` — 로컬 목업 로그인만 사용 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        heartbeatIntervalMs: 30_000,
      },
    });
  }
  return client;
}
