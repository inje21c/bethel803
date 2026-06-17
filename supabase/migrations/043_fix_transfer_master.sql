-- 043: transfer_master 쿼리 수정
-- users.district_id JOIN 대신 users.church_id 직접 참조로 변경

CREATE OR REPLACE FUNCTION public.transfer_master(p_new_master_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id     UUID := auth.uid();
  v_church_id     UUID;
  v_target_church UUID;
BEGIN
  -- 호출자가 마스터인지 확인 (users.church_id 직접 참조)
  SELECT church_id INTO v_church_id
  FROM public.users
  WHERE id = v_caller_id
    AND role = 'master'
    AND status = 'active';

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION '마스터만 권한을 이관할 수 있습니다.';
  END IF;

  IF p_new_master_id = v_caller_id THEN
    RAISE EXCEPTION '본인에게 이관할 수 없습니다.';
  END IF;

  -- 대상이 같은 교회의 활성 구성원인지 확인
  SELECT church_id INTO v_target_church
  FROM public.users
  WHERE id = p_new_master_id
    AND status = 'active';

  IF v_target_church IS NULL OR v_target_church != v_church_id THEN
    RAISE EXCEPTION '대상 사용자가 같은 교회의 활성 구성원이 아닙니다.';
  END IF;

  -- 현 마스터 → leader, 대상 → master
  UPDATE public.users SET role = 'leader' WHERE id = v_caller_id;
  UPDATE public.users SET role = 'master' WHERE id = p_new_master_id;
END;
$$;
