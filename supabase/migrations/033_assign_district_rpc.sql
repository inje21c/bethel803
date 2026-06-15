-- 소셜 로그인(OAuth) 초대 링크 가입 후 district 재배정
-- 트리거가 잘못된 교회에 배정한 경우 수정
CREATE OR REPLACE FUNCTION public.assign_my_district(p_district_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id UUID;
BEGIN
  -- 대상 구역이 활성 상태인지 확인
  SELECT church_id INTO v_church_id
  FROM public.districts
  WHERE id = p_district_id AND is_active = true;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION '유효하지 않은 구역입니다.';
  END IF;

  -- 이미 같은 구역이면 무시
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND district_id = p_district_id
  ) THEN
    RETURN;
  END IF;

  -- district_id, church_id 업데이트 (pending 상태 유지)
  UPDATE public.users
  SET district_id = p_district_id,
      church_id = v_church_id
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_my_district(UUID) TO authenticated;
