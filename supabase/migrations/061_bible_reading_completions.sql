-- ============================================================
-- 061: 성경 완독(회독) 기록 — 완독 횟수 배지 + 재시작 지원
-- ============================================================
-- 읽기표(bible_reading_plans)는 completed_at 한 칸짜리 일회용 계획이라
-- "몇 바퀴 완독했는가(회독)" 개념이 없었다. 완독 후 모든 장이 completed 상태라
-- 다시 읽으며 체크해도 누적 장수가 늘지 않는 문제가 있었다.
--
-- 이 테이블은 "사용자가 N번째 완독했다"는 이벤트를 사용자 단위로 영구 기록한다.
--  - 완독 횟수 = 이 테이블의 row 수 (배지의 단일 진실 소스)
--  - source 'auto': 읽기표 100% 달성 시 자동 기록
--  - source 'self_report': 오프라인 완독 등 사용자가 직접 "완독 기록"
-- 재시작은 읽기표 item/day의 completed_at을 비워 새 바퀴를 시작하며,
-- bible_reading_logs(누적 장수)는 보존되어 2바퀴째부터 다시 누적된다.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bible_reading_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  church_id UUID,
  plan_id UUID REFERENCES public.bible_reading_plans(id) ON DELETE SET NULL,
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'old', 'new', 'custom')),
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lap_number INTEGER NOT NULL CHECK (lap_number > 0),
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'self_report')),
  chapters_snapshot INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, lap_number)
);

CREATE INDEX IF NOT EXISTS idx_bible_reading_completions_user
  ON public.bible_reading_completions(user_id, lap_number DESC);

ALTER TABLE public.bible_reading_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bible_reading_completions_own" ON public.bible_reading_completions;
CREATE POLICY "bible_reading_completions_own" ON public.bible_reading_completions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 본인 완독 횟수 (배지용). SECURITY INVOKER: 호출자 RLS 그대로.
CREATE OR REPLACE FUNCTION public.get_bible_completion_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.bible_reading_completions
  WHERE user_id = p_user_id;
$$;

-- 구역 전체 완독 횟수 요약 (구역장 대시보드).
-- SECURITY DEFINER: 구역 집계이므로 RLS 우회, district_id로 필터.
CREATE OR REPLACE FUNCTION public.get_bible_completion_counts(p_district_id UUID)
RETURNS TABLE(user_id UUID, user_name TEXT, completion_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    u.id                        AS user_id,
    u.name                      AS user_name,
    COUNT(c.id)::BIGINT         AS completion_count
  FROM public.users u
  LEFT JOIN public.bible_reading_completions c ON c.user_id = u.id
  WHERE u.district_id = p_district_id
  GROUP BY u.id, u.name;
$$;

-- 완독 기록 + 배지 증가. 읽기표 100% 달성(자동) 또는 사용자의 완독 선언(수동) 시 호출.
-- status='completed' 가드로 같은 바퀴에 대한 중복 기록을 막는다(멱등).
-- 반환값 = 이 완독의 lap_number(= 누적 완독 횟수).
CREATE OR REPLACE FUNCTION public.record_bible_completion(
  p_plan_id UUID,
  p_source  TEXT DEFAULT 'auto'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_plan     public.bible_reading_plans%ROWTYPE;
  v_lap      INTEGER;
  v_chapters INTEGER;
  v_source   TEXT := CASE WHEN p_source = 'self_report' THEN 'self_report' ELSE 'auto' END;
BEGIN
  SELECT * INTO v_plan
  FROM public.bible_reading_plans
  WHERE id = p_plan_id AND owner_user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION '읽기표를 찾을 수 없습니다.';
  END IF;

  -- 이미 완독 처리된 계획이면 중복 기록하지 않고 현재 횟수만 반환
  IF v_plan.status = 'completed' THEN
    RETURN (SELECT COUNT(*)::INTEGER FROM public.bible_reading_completions WHERE user_id = v_uid);
  END IF;

  SELECT COALESCE(MAX(lap_number), 0) + 1 INTO v_lap
  FROM public.bible_reading_completions WHERE user_id = v_uid;

  SELECT COALESCE(SUM(chapters), 0) INTO v_chapters
  FROM public.bible_reading_logs WHERE user_id = v_uid;

  INSERT INTO public.bible_reading_completions
    (user_id, church_id, plan_id, scope, completed_date, lap_number, source, chapters_snapshot)
  VALUES
    (v_uid, v_plan.church_id, p_plan_id, v_plan.scope, CURRENT_DATE, v_lap, v_source, v_chapters);

  UPDATE public.bible_reading_plans SET status = 'completed' WHERE id = p_plan_id;

  RETURN v_lap;
END;
$$;

-- 새 바퀴 시작. 읽기표의 모든 장/날의 completed_at을 비우고 오늘부터 일정을 재배치한다.
-- bible_reading_logs(누적 장수)는 건드리지 않아 지난 바퀴 기록이 보존되고,
-- 새 바퀴부터 다시 누적된다. 단일 UPDATE로 날짜를 재계산해 UNIQUE 충돌을 피한다.
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

  -- 다른 대표 읽기표가 있으면 해제하고 이 계획을 다시 대표/활성으로
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

REVOKE ALL ON FUNCTION public.get_bible_completion_count(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_bible_completion_count(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_bible_completion_counts(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_bible_completion_counts(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_bible_completion(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_bible_completion(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.restart_bible_reading_plan(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.restart_bible_reading_plan(UUID) TO authenticated;
