/**
 * Supabase Edge Functions invoke 실패 시 본문·코드 → 한글 안내
 * (functions.invoke는 비-2xx여도 `data`에 JSON이 올 수 있음)
 */

/** 클라이언트·DB에서 오는 짧은 오류 코드 */
export const SOS_SEND_ERROR_KO: Record<string, string> = {
  not_logged_in: '로그인이 필요해요.',
  quota_check_failed: '발송 가능 여부를 확인하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.',
  save_failed: '신호를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

export const EDGE_FN_ERROR_KO: Record<string, string> = {
  method_not_allowed: '지원하지 않는 요청 방식이에요.',
  server_misconfigured: '서버 설정이 올바르지 않아요. 관리자에게 문의해 주세요.',
  missing_groq: 'AI 검토 기능이 연결되지 않았어요. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.',
  no_auth: '로그인이 필요해요. 다시 로그인한 뒤 시도해 주세요.',
  not_authenticated: '인증이 만료됐거나 확인할 수 없어요. 다시 로그인해 주세요.',
  invalid_json: '요청 형식이 올바르지 않아요.',
  bad_signal_type: 'SOS 유형이 올바르지 않아요.',
  image_required: '사진 데이터가 비어 있어요.',
  payload_too_large: '사진 용량이 너무 커요. 더 작은 사진을 선택하거나 해상도를 낮춰 주세요.',
  groq_failed: 'AI 분석 서버에 일시적으로 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  groq_parse: 'AI 판독 결과를 해석하지 못했어요. 다른 사진으로 다시 시도해 주세요.',
  text_too_long: '입력한 글자 수가 너무 많아요. 줄인 뒤 다시 시도해 주세요.',
};

export function edgeFnBodyFields(data: unknown): { ok?: boolean; error?: string; reason?: string } {
  if (!data || typeof data !== 'object') return {};
  const o = data as Record<string, unknown>;
  return {
    ok: typeof o.ok === 'boolean' ? o.ok : undefined,
    error: typeof o.error === 'string' ? o.error : undefined,
    reason: typeof o.reason === 'string' ? o.reason : undefined,
  };
}

export function koreanReasonFromEdgeInvoke(
  data: unknown,
  fallback = '처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
): string {
  const { error: code, reason } = edgeFnBodyFields(data);
  const trimmed = reason?.trim();
  if (trimmed) return trimmed;
  if (code && EDGE_FN_ERROR_KO[code]) return EDGE_FN_ERROR_KO[code];
  return fallback;
}
