-- ============================================================
-- 062: restart_bible_reading_plan 날짜 충돌(409) 수정
-- ============================================================
-- bible_reading_plan_days 에 UNIQUE(plan_id, scheduled_date) 제약이 있다.
-- 재시작 시 모든 날짜를 '오늘 + N'으로 한 번에 UPDATE 하면, 기존 일정과
-- 새 일정의 날짜 범위가 겹칠 때 행 단위 즉시 검사에서 중간 상태 충돌(409)이
-- 발생한다. 날짜를 먼저 먼 미래로 임시 이동(서로/기존과 겹치지 않음)한 뒤
-- 최종 날짜로 설정하는 2단계 방식으로 바꾼다.
-- ============================================================

CREATE OR REPLACE FUNCTION public.restart_bible_reading_plan(p_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_day_count INTEGER;
BEGIN
  PERFORM 1 FROM public.bible_reading_plans
  WHERE id = p_plan_id AND owner_user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION '읽기표를 찾을 수 없습니다.';
  END IF;

  UPDATE public.bible_reading_plan_day_items
    SET completed_at = NULL, reading_log_id = NULL
  WHERE plan_id = p_plan_id;

  -- 1단계: 날짜를 먼 미래로 임시 이동(기존/서로 어떤 날짜와도 겹치지 않음)
  UPDATE public.bible_reading_plan_days d
    SET scheduled_date = DATE '9999-01-01' + (s.rn - 1)::INTEGER
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY day_number) AS rn
    FROM public.bible_reading_plan_days
    WHERE plan_id = p_plan_id
  ) s
  WHERE d.id = s.id;

  -- 2단계: 오늘 기준 최종 날짜로 재배치 + 완료 상태 초기화
  UPDATE public.bible_reading_plan_days d
    SET completed_at = NULL,
        scheduled_date = CURRENT_DATE + (s.rn - 1)::INTEGER
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY day_number) AS rn
    FROM public.bible_reading_plan_days
    WHERE plan_id = p_plan_id
  ) s
  WHERE d.id = s.id;

  SELECT COUNT(*) INTO v_day_count
  FROM public.bible_reading_plan_days WHERE plan_id = p_plan_id;

  UPDATE public.bible_reading_plans
    SET is_primary = false
  WHERE owner_user_id = v_uid AND id <> p_plan_id AND is_primary = true;

  UPDATE public.bible_reading_plans
    SET status = 'active',
        is_primary = true,
        start_date = CURRENT_DATE,
        end_date = CURRENT_DATE + GREATEST(v_day_count - 1, 0)
  WHERE id = p_plan_id;
END;
$$;
