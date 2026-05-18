import type { SupabaseClient } from '@supabase/supabase-js';

const RPC_ERROR_KO: Record<string, string> = {
  forbidden: '관리자만 삭제할 수 있어요.',
  not_found: '이미 삭제됐거나 제보를 찾을 수 없어요.',
  not_found_after_delete: '제보 행을 지우지 못했어요.',
  report_id_required: '제보 ID가 없어요.',
  delete_failed: 'DB·Storage 삭제 중 오류가 났어요.',
};

type DeleteResult = { ok: true } | { ok: false; message: string };

function parseRpcBody(data: unknown): { ok?: boolean; error?: string; detail?: string } {
  if (!data || typeof data !== 'object') return {};
  const o = data as Record<string, unknown>;
  return {
    ok: typeof o.ok === 'boolean' ? o.ok : undefined,
    error: typeof o.error === 'string' ? o.error : undefined,
    detail: typeof o.detail === 'string' ? o.detail : undefined,
  };
}

/** 관리자: spot_reports + spot-photos Storage 즉시 삭제 (RPC 우선, Edge는 예비) */
export async function adminDeleteSpotReport(
  sb: SupabaseClient,
  reportId: string,
): Promise<DeleteResult> {
  const id = reportId.trim();
  if (!id) return { ok: false, message: '제보 ID가 없어요.' };

  const { data: rpcData, error: rpcError } = await sb.rpc('admin_delete_spot_report', {
    p_report_id: id,
  });

  if (!rpcError) {
    const body = parseRpcBody(rpcData);
    if (body.ok) return { ok: true };
    const code = body.error ?? '';
    return {
      ok: false,
      message: body.detail?.trim() || RPC_ERROR_KO[code] || code || '삭제에 실패했어요.',
    };
  }

  const rpcMissing =
    rpcError.code === '42883' ||
    rpcError.code === 'PGRST202' ||
    /could not find the function/i.test(rpcError.message);

  if (!rpcMissing) {
    return { ok: false, message: rpcError.message || '삭제에 실패했어요.' };
  }

  const { data: fnData, error: fnError } = await sb.functions.invoke('admin-delete-spot-report', {
    body: { reportId: id },
  });
  if (fnError) {
    const hint =
      /failed to send a request to the edge function/i.test(fnError.message) ||
      /FunctionsFetchError/i.test(fnError.name ?? '')
        ? 'Supabase에 `admin_delete_spot_report` RPC 마이그레이션을 적용하거나 Edge Function `admin-delete-spot-report`를 배포해 주세요.'
        : fnError.message;
    return { ok: false, message: hint };
  }
  const fnBody = parseRpcBody(fnData);
  if (fnBody.ok) return { ok: true };
  const code = fnBody.error ?? '';
  return {
    ok: false,
    message: fnBody.detail?.trim() || RPC_ERROR_KO[code] || code || '삭제에 실패했어요.',
  };
}
