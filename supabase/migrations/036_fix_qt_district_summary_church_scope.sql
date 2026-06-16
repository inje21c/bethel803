-- ============================================================
-- 036. get_qt_district_summary: qt_contents JOIN에 church_id 스코프 추가
-- ============================================================
-- 034에서 users.church_id 가드는 추가했으나 qt_contents JOIN이
-- 날짜만으로 조인되어 다교회 환경에서 교회 수만큼 행이 중복 생성됨.
-- LEFT JOIN 조건에 church_id 일치를 추가해 수정.

CREATE OR REPLACE FUNCTION public.get_qt_district_summary(
  p_district_id UUID,
  p_date        DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Seoul')::DATE
)
RETURNS TABLE(
  user_id        UUID,
  user_name      TEXT,
  is_completed   BOOLEAN,
  current_streak INT,
  last_completed DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    u.id                                AS user_id,
    u.name                              AS user_name,
    COALESCE(qr.is_completed, false)    AS is_completed,
    COALESCE(st.current_streak, 0)      AS current_streak,
    st.last_completed_date              AS last_completed
  FROM public.users u
  LEFT JOIN public.qt_contents qc
         ON qc.date = p_date
        AND qc.church_id = public.get_my_church_id()
  LEFT JOIN public.qt_responses qr ON qr.user_id = u.id AND qr.content_id = qc.id
  LEFT JOIN public.streaks st ON st.user_id = u.id
  WHERE u.district_id = p_district_id
    AND u.status = 'active'
    AND u.church_id = public.get_my_church_id()
  ORDER BY is_completed DESC, u.name;
$$;
