-- ============================================================
-- 016: 성경읽기 집계 RPC 함수
-- JS 메모리 집계 → DB GROUP BY SUM으로 최적화
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

-- 1. 특정 사용자의 총 읽은 장 수 (Dashboard 위젯용)
--    SECURITY INVOKER: 호출자(본인)의 RLS 그대로 적용
CREATE OR REPLACE FUNCTION public.get_total_chapters(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(chapters), 0)::BIGINT
  FROM public.bible_reading_logs
  WHERE user_id = p_user_id;
$$;

-- 2. 구역 전체 성경읽기 요약 (AdminDashboard 성경읽기 탭)
--    SECURITY DEFINER: 구역 집계이므로 RLS 우회, district_id로 필터
CREATE OR REPLACE FUNCTION public.get_bible_reading_summaries(p_district_id UUID)
RETURNS TABLE(user_id UUID, user_name TEXT, total_chapters BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    brl.user_id,
    u.name            AS user_name,
    SUM(brl.chapters)::BIGINT AS total_chapters
  FROM public.bible_reading_logs brl
  JOIN public.users u ON u.id = brl.user_id
  WHERE u.district_id = p_district_id
  GROUP BY brl.user_id, u.name
  ORDER BY total_chapters DESC;
$$;

-- 3. 기간별 구역 성경읽기 요약 (AdminDashboard 기간 필터)
CREATE OR REPLACE FUNCTION public.get_bible_reading_summaries_by_range(
  p_district_id UUID,
  p_from        DATE,
  p_to          DATE
)
RETURNS TABLE(user_id UUID, user_name TEXT, total_chapters BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    brl.user_id,
    u.name            AS user_name,
    SUM(brl.chapters)::BIGINT AS total_chapters
  FROM public.bible_reading_logs brl
  JOIN public.users u ON u.id = brl.user_id
  WHERE u.district_id = p_district_id
    AND brl.log_date >= p_from
    AND brl.log_date <= p_to
  GROUP BY brl.user_id, u.name
  ORDER BY total_chapters DESC;
$$;

-- RPC 호출 권한 (anon 제외, 인증된 사용자만)
REVOKE ALL ON FUNCTION public.get_total_chapters(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_total_chapters(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_bible_reading_summaries(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_bible_reading_summaries(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_bible_reading_summaries_by_range(UUID, DATE, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_bible_reading_summaries_by_range(UUID, DATE, DATE) TO authenticated;
