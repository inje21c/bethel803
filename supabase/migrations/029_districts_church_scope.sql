-- ============================================================
-- 029: districts 조회를 교회 경계로 축소
-- 021의 districts_select_active가 모든 교회의 활성 구역을 노출하던 것을
-- 인증 사용자는 자기 교회 구역만 보도록 수정한다.
-- (anon 정책은 가입 화면 구역 선택용으로 유지 — slug 가입 도입 시 축소 예정)
-- 전제: 021
-- ============================================================

DO $$ BEGIN
  IF to_regclass('public.churches') IS NULL THEN
    RAISE EXCEPTION '021_saas_church_scope must be applied before 029 (churches table missing)';
  END IF;
END $$;

DROP POLICY IF EXISTS "districts_select_active" ON public.districts;
CREATE POLICY "districts_select_active" ON public.districts
  FOR SELECT TO authenticated USING (
    is_active = true
    AND church_id = public.get_my_church_id()
    AND EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.id = districts.church_id
        AND c.status IN ('active', 'trialing')
    )
  );

-- 비활성 구역 포함 전체 관리 조회는 기존 districts_all_master(자기 교회 한정)가 담당한다.
