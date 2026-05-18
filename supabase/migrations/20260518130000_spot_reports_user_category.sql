-- 커뮤니티 사진 갤러리: 사용자가 제보 시 직접 선택하는 카테고리 컬럼
ALTER TABLE spot_reports
  ADD COLUMN IF NOT EXISTS user_category text
  CHECK (
    user_category IS NULL OR user_category IN (
      'scenery', 'night', 'busking', 'food', 'cafe',
      'shopping', 'festival', 'sports', 'nature',
      'club', 'exhibition', 'daily'
    )
  );

-- 갤러리 쿼리(카테고리 + 최신순) 성능용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_spot_reports_user_category_created
  ON spot_reports (user_category, created_at DESC)
  WHERE user_category IS NOT NULL;
