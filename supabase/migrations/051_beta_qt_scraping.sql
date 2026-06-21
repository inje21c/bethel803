-- ============================================================
-- 051. 베타 모듈: QT 말씀 스크래핑 추가
-- ============================================================
-- 현재 벧엘교회(legacy)만 사용하는 자동 스크래핑 QT 콘텐츠를
-- 베타 기간 동안 모든 가입자에게도 한시 개방하기 위한 플래그.
-- 켜면 qt_mode='simple' 교회도 스크래핑 QT를 보게 된다.
--
-- qt_contents는 교회 스코프(RLS)라서, 비-벧엘 교회는 자기 교회의
-- qt_contents 행이 없으면 콘텐츠를 못 본다. 따라서 읽기 직전에
-- 벧엘(소스 교회)의 당일 콘텐츠를 자기 교회로 복사하는 RPC를 둔다.
-- (fetch-devotional Edge Function의 교회별 복사 로직과 동일한 모델)

INSERT INTO public.beta_flags (module, enabled) VALUES
  ('qt_scraping', false)
ON CONFLICT (module) DO NOTHING;

-- 내 교회에 당일 스크래핑 QT가 없으면 벧엘 콘텐츠를 복사한다.
-- 베타 플래그가 꺼져 있거나, 내 교회가 소스 교회면 아무것도 하지 않는다.
DROP FUNCTION IF EXISTS public.ensure_my_scraped_qt(DATE);
CREATE OR REPLACE FUNCTION public.ensure_my_scraped_qt(p_date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_church     UUID;
  v_enabled       BOOLEAN;
  v_source_church UUID := '00000000-0000-4100-a000-000000000001';
BEGIN
  SELECT enabled INTO v_enabled FROM public.beta_flags WHERE module = 'qt_scraping';
  IF COALESCE(v_enabled, false) IS NOT TRUE THEN
    RETURN;
  END IF;

  v_my_church := public.get_my_church_id();
  IF v_my_church IS NULL OR v_my_church = v_source_church THEN
    RETURN; -- 소스 교회는 이미 자기 콘텐츠 보유
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.qt_contents
    WHERE church_id = v_my_church AND date = p_date
  ) THEN
    RETURN; -- 이미 복사됨
  END IF;

  INSERT INTO public.qt_contents (
    church_id, date, title, scripture, scripture_text, summary,
    question, prayer, application, audio_url, hymn_suggestions,
    deep_summary, deep_questions
  )
  SELECT
    v_my_church, date, title, scripture, scripture_text, summary,
    question, prayer, application, audio_url, hymn_suggestions,
    deep_summary, deep_questions
  FROM public.qt_contents
  WHERE church_id = v_source_church AND date = p_date
  ON CONFLICT (church_id, date) DO NOTHING;
END;
$$;
