-- 상대 지도 핀: profiles UPDATE 시 Supabase Realtime으로 클라이언트에 즉시 전달
-- (프로젝트에 이미 포함돼 있으면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
