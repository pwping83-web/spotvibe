-- AI 자동 카테고리 분류 + 관리자 검토 시스템
-- ai_category_confidence : AI 신뢰도 (0.000~1.000), NULL = AI 미사용
-- needs_category_review  : 신뢰도 낮거나 애매해서 관리자 검토 필요 여부
-- admin_category         : 관리자가 직접 수정한 카테고리 (최우선)

ALTER TABLE spot_reports
  ADD COLUMN IF NOT EXISTS ai_category_confidence numeric(4,3)
    CHECK (ai_category_confidence IS NULL OR (ai_category_confidence >= 0 AND ai_category_confidence <= 1)),
  ADD COLUMN IF NOT EXISTS needs_category_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_category text
    CHECK (
      admin_category IS NULL OR admin_category IN (
        'scenery', 'night', 'busking', 'food', 'cafe',
        'shopping', 'festival', 'sports', 'nature',
        'club', 'exhibition', 'daily'
      )
    );

-- 관리자 검토 큐 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_spot_reports_needs_review
  ON spot_reports (needs_category_review, created_at DESC)
  WHERE needs_category_review = true;

-- 관리자가 카테고리를 수정하는 RPC
CREATE OR REPLACE FUNCTION public.admin_set_spot_category(
  p_report_id uuid,
  p_category   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- 관리자 확인
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- 유효 카테고리 검사
  IF p_category IS NOT NULL AND p_category NOT IN (
    'scenery','night','busking','food','cafe',
    'shopping','festival','sports','nature',
    'club','exhibition','daily'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_category');
  END IF;

  UPDATE public.spot_reports
  SET
    admin_category        = p_category,
    needs_category_review = false
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_spot_category(uuid, text) TO authenticated;
