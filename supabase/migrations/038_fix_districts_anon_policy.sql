-- ============================================================
-- 038. districts_select_anon 정책 수정
-- ============================================================
-- 021에서 districts_select_anon에 churches EXISTS 체크가 추가됐으나,
-- 034에서 churches 테이블이 get_my_church_id() 기반으로 잠기면서
-- anon 사용자의 churches 접근이 불가능해짐.
-- 결과: EXISTS 서브쿼리가 항상 false → 초대 링크(/join) 조회 시 [] 반환.
--
-- 해결: churches 상태 확인을 SECURITY DEFINER 함수로 감싸
--       RLS를 우회하면서 유효한 교회인지 확인.

CREATE OR REPLACE FUNCTION public.is_church_joinable(p_church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.churches
    WHERE id = p_church_id
      AND status IN ('active', 'trialing')
  )
$$;

DROP POLICY IF EXISTS "districts_select_anon" ON public.districts;
CREATE POLICY "districts_select_anon" ON public.districts
  FOR SELECT TO anon USING (
    is_active = true
    AND public.is_church_joinable(church_id)
  );
