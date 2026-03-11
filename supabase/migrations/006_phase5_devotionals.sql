-- ============================================================
-- Phase 5: 묵상 AI 스크래핑
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

-- daily_devotionals 테이블
CREATE TABLE IF NOT EXISTS public.daily_devotionals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  verse       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  source_url  TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.daily_devotionals ENABLE ROW LEVEL SECURITY;

-- active 사용자는 읽기 가능
CREATE POLICY "active users can read devotionals"
  ON public.daily_devotionals
  FOR SELECT
  USING (is_active());

-- Edge Function에서만 insert/upsert 가능 (service_role 사용)
-- service_role은 RLS 우회하므로 별도 정책 불필요

-- ============================================================
-- pg_cron: 매일 21:00 UTC (다음날 KST 06:00) 자동 실행
-- pg_cron 익스텐션이 활성화된 경우 주석 해제 후 실행
-- ============================================================
-- SELECT cron.schedule(
--   'fetch-devotional-daily',
--   '0 21 * * *',  -- 매일 21:00 UTC = 다음날 06:00 KST
--   $$
--     SELECT net.http_post(
--       url := current_setting('app.supabase_url') || '/functions/v1/fetch-devotional',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );
