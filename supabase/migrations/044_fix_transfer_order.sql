-- 044: transfer_master UPDATE 순서 수정
-- enforce_role_change BEFORE 트리거 때문에:
-- 구 순서: caller 강등 → target 승격 (강등 후엔 caller가 master가 아니므로 트리거 실패)
-- 신 순서: target 승격 → caller 강등 (두 UPDATE 모두 BEFORE 시점엔 caller가 master)

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

  SELECT church_id INTO v_target_church
  FROM public.users
  WHERE id = p_new_master_id
    AND status = 'active';

  IF v_target_church IS NULL OR v_target_church != v_church_id THEN
    RAISE EXCEPTION '대상 사용자가 같은 교회의 활성 구성원이 아닙니다.';
  END IF;

  -- 순서 중요: target 먼저 승격 → caller 강등
  -- BEFORE 트리거 시점에 caller가 여전히 master이므로 두 UPDATE 모두 통과
  UPDATE public.users SET role = 'master' WHERE id = p_new_master_id;
  UPDATE public.users SET role = 'leader' WHERE id = v_caller_id;
END;
$$;
