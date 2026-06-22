-- ============================================================
-- 054. anon 구역 열거 차단 + 초대용 단건 조회 RPC
-- ============================================================
-- 문제: get_active_districts_with_church() RPC와 anon SELECT 정책이
--       익명 사용자에게 전 테넌트의 모든 교회/구역 이름을 열거하게 함.
-- 조치:
-- - 초대 링크(/join)는 구역 id 단건만 필요 → get_join_district(id) RPC로 대체.
-- - 전역 열거 RPC 폐기 + anon 의 districts 직접 SELECT 권한 회수.
-- (authenticated 의 구역명 열거 조이기는 별도 단계에서 격리 테스트와 함께 처리.)
-- 설계: docs/기능설계/모임우선_아키텍처_재설계.md (12.0)
-- ============================================================

-- 초대 링크용 단건 조회 (활성 + 교회 활성/체험 + 미삭제일 때만 1행 반환)
CREATE OR REPLACE FUNCTION public.get_join_district(p_id uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name
  FROM public.districts d
  JOIN public.churches c ON c.id = d.church_id
  WHERE d.id = p_id
    AND d.is_active = true
    AND c.status IN ('active', 'trialing')
    AND (c.deleted_at IS NULL OR c.deleted_at > NOW());
$$;

GRANT EXECUTE ON FUNCTION public.get_join_district(uuid) TO anon, authenticated;

-- 전역 열거 RPC 폐기 (DistrictPicker 제거로 사용처 없음)
DROP FUNCTION IF EXISTS public.get_active_districts_with_church();

-- anon 의 districts 직접 SELECT 차단 (열거 방지). 초대는 위 RPC로만.
DROP POLICY IF EXISTS "districts_select_anon" ON public.districts;
REVOKE SELECT ON public.districts FROM anon;
