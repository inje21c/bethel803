-- ============================================================
-- 024: 읽기표 자동 기록을 날짜 + 읽기표명 단위로 누적
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_bible_reading_logs_daily_plan_label_once
  ON public.bible_reading_logs(user_id, plan_id, log_date, source_label)
  WHERE source_type = 'plan'
    AND plan_id IS NOT NULL
    AND plan_day_id IS NULL
    AND source_label IS NOT NULL;
