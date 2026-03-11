-- ============================================================
-- Phase 4: 주간 마감 자동화
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

-- weekly_reports에 week_number 컬럼 추가 (없으면)
ALTER TABLE public.weekly_reports ADD COLUMN IF NOT EXISTS week_number INTEGER;

-- week_start UNIQUE 제약 (ON CONFLICT 사용 위해 필요)
ALTER TABLE public.weekly_reports DROP CONSTRAINT IF EXISTS weekly_reports_week_start_key;
ALTER TABLE public.weekly_reports ADD CONSTRAINT weekly_reports_week_start_key UNIQUE (week_start);

-- ============================================================
-- 주간 보고서 집계 함수
-- - pg_cron 직접 호출 시: auth.uid() = null → 통과
-- - 프론트 RPC 호출 시: 구역장만 허용
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_weekly_report(p_week_start DATE)
RETURNS JSON AS $$
DECLARE
  v_week_end DATE;
  v_week_number INTEGER;
  v_attendance_count INTEGER;
  v_attendance_names TEXT[];
  v_bible_chapters INTEGER;
  v_study_completion INTEGER;
  v_report_text TEXT;
BEGIN
  -- 구역장 권한 확인 (pg_cron 호출 시 auth.uid()=null이면 통과)
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: leader only';
  END IF;

  v_week_end := p_week_start + INTERVAL '6 days';
  v_week_number := EXTRACT(WEEK FROM p_week_start);

  -- 출석 집계 (이번 주 출석체크 일정 기준)
  SELECT
    COUNT(a.user_id)::INTEGER,
    ARRAY_AGG(u.name ORDER BY u.name)
  INTO v_attendance_count, v_attendance_names
  FROM public.attendances a
  JOIN public.schedules s ON a.schedule_id = s.id
  JOIN public.users u ON a.user_id = u.id
  WHERE s.schedule_date BETWEEN p_week_start AND v_week_end
    AND s.attendance_check = true
    AND a.status = 'attending';

  -- 성경읽기 합계 (이번 주 기록)
  SELECT COALESCE(SUM(chapters), 0)::INTEGER
  INTO v_bible_chapters
  FROM public.bible_reading_logs
  WHERE log_date BETWEEN p_week_start AND v_week_end;

  -- 성경공부 완료 수 (이번 주 발행 공부 기준)
  SELECT COUNT(sa.id)::INTEGER
  INTO v_study_completion
  FROM public.study_answers sa
  JOIN public.bible_studies bs ON sa.study_id = bs.id
  WHERE bs.study_date BETWEEN p_week_start AND v_week_end
    AND sa.completed = true;

  -- 카카오톡 보고문자 텍스트
  v_report_text := format(
    '[%s주차 구역 보고]' || E'\n' ||
    '출석: %s명 (%s)' || E'\n' ||
    '성경읽기: %s장' || E'\n' ||
    '성경공부 완료: %s명',
    v_week_number,
    COALESCE(v_attendance_count, 0),
    COALESCE(ARRAY_TO_STRING(v_attendance_names, ', '), '없음'),
    COALESCE(v_bible_chapters, 0),
    COALESCE(v_study_completion, 0)
  );

  -- weekly_reports upsert
  INSERT INTO public.weekly_reports (
    week_start, week_end, week_number,
    attendance_count, attendance_names,
    bible_chapters_total, study_completion_count,
    report_text, is_locked
  ) VALUES (
    p_week_start, v_week_end, v_week_number,
    COALESCE(v_attendance_count, 0),
    COALESCE(v_attendance_names, ARRAY[]::TEXT[]),
    COALESCE(v_bible_chapters, 0),
    COALESCE(v_study_completion, 0),
    v_report_text,
    true
  )
  ON CONFLICT (week_start) DO UPDATE SET
    week_end          = EXCLUDED.week_end,
    week_number       = EXCLUDED.week_number,
    attendance_count  = EXCLUDED.attendance_count,
    attendance_names  = EXCLUDED.attendance_names,
    bible_chapters_total     = EXCLUDED.bible_chapters_total,
    study_completion_count   = EXCLUDED.study_completion_count,
    report_text       = EXCLUDED.report_text,
    is_locked         = true,
    updated_at        = NOW();

  RETURN json_build_object(
    'week_start',             p_week_start,
    'week_end',               v_week_end,
    'week_number',            v_week_number,
    'attendance_count',       COALESCE(v_attendance_count, 0),
    'attendance_names',       COALESCE(v_attendance_names, ARRAY[]::TEXT[]),
    'bible_chapters_total',   COALESCE(v_bible_chapters, 0),
    'study_completion_count', COALESCE(v_study_completion, 0),
    'report_text',            v_report_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS 정책: weekly_reports (이미 001에서 활성화됨)
-- 구역장만 RPC 호출 가능하므로 추가 정책 불필요
-- ============================================================

-- ============================================================
-- pg_cron 설정 (pg_cron extension 활성화 후 아래 주석 해제하여 실행)
-- Supabase 대시보드 → Database → Extensions → pg_cron 활성화
-- ============================================================
-- SELECT cron.schedule(
--   'weekly-close',
--   '20 2 * * 0',  -- 매주 일요일 02:20 UTC = 11:20 KST
--   $$
--   SELECT public.compute_weekly_report(
--     DATE_TRUNC('week',
--       (NOW() AT TIME ZONE 'Asia/Seoul')::DATE
--     )::DATE
--   )
--   $$
-- );
--
-- 스케줄 확인: SELECT * FROM cron.job;
-- 스케줄 삭제: SELECT cron.unschedule('weekly-close');
