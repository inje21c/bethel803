-- ============================================================
-- 057. 슈퍼어드민 교회 생성 RPC
-- ============================================================
-- 모임우선 구조에서 교회(church)는 슈퍼어드민이 B2B로 직접 생성한다.
-- 교회 + 첫 구역을 만들고, master는 이후 첫 사용자가 해당 구역 초대 링크로
-- 가입할 때 handle_new_user 분기 B(빈 교회 첫 사용자=master)로 자동 배정된다.
-- 설계: docs/기능설계/모임우선_아키텍처_재설계.md (8장)
-- ============================================================

DROP FUNCTION IF EXISTS public.create_church_superadmin(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_church_superadmin(
  p_name          TEXT,
  p_district_name TEXT DEFAULT '1구역',
  p_plan          TEXT DEFAULT 'free'
)
RETURNS TABLE (church_id UUID, district_id UUID, slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id   UUID;
  v_district_id UUID;
  v_slug        TEXT;
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION '교회 이름이 필요합니다';
  END IF;

  v_slug := public.generate_church_slug(p_name);

  INSERT INTO public.churches (name, slug, status, plan, billing_status, trial_ends_at)
  VALUES (trim(p_name), v_slug, 'active', p_plan, 'manual', NULL)
  RETURNING id INTO v_church_id;
  -- church_settings는 churches_default_settings(AFTER INSERT) 트리거가 생성.

  INSERT INTO public.districts (name, church_id, is_active)
  VALUES (COALESCE(NULLIF(trim(p_district_name), ''), '1구역'), v_church_id, true)
  RETURNING id INTO v_district_id;

  RETURN QUERY SELECT v_church_id, v_district_id, v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_church_superadmin(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_church_superadmin(TEXT, TEXT, TEXT) TO authenticated;
