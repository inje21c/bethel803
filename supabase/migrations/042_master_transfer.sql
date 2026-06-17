-- 042: 마스터 이관 RPC
-- transfer_master: 현 마스터가 다른 구성원에게 마스터 권한 이관
-- change_master_superadmin: 슈퍼어드민이 교회 마스터 강제 변경
-- get_church_members_superadmin: 슈퍼어드민용 교회 구성원 목록

-- ── 1. 마스터 자체 이관 ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_master(p_new_master_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id      UUID := auth.uid();
  v_church_id      UUID;
  v_target_church  UUID;
BEGIN
  -- 호출자가 마스터인지 확인
  SELECT d.church_id INTO v_church_id
  FROM public.users u
  JOIN public.districts d ON d.id = u.district_id
  WHERE u.id = v_caller_id
    AND u.role = 'master'
    AND u.status = 'active';

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION '마스터만 권한을 이관할 수 있습니다.';
  END IF;

  -- 자기 자신에게 이관 시도 방지
  IF p_new_master_id = v_caller_id THEN
    RAISE EXCEPTION '본인에게 이관할 수 없습니다.';
  END IF;

  -- 대상이 같은 교회의 활성 구성원인지 확인
  SELECT d.church_id INTO v_target_church
  FROM public.users u
  JOIN public.districts d ON d.id = u.district_id
  WHERE u.id = p_new_master_id
    AND u.status = 'active';

  IF v_target_church IS NULL OR v_target_church != v_church_id THEN
    RAISE EXCEPTION '대상 사용자가 같은 교회의 활성 구성원이 아닙니다.';
  END IF;

  -- 현 마스터 → leader로 강등
  UPDATE public.users SET role = 'leader' WHERE id = v_caller_id;
  -- 대상 → master로 승격
  UPDATE public.users SET role = 'master' WHERE id = p_new_master_id;
END;
$$;

-- ── 2. 슈퍼어드민 강제 마스터 변경 ──────────────────────────────
CREATE OR REPLACE FUNCTION public.change_master_superadmin(
  p_church_id    UUID,
  p_new_master_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION '슈퍼어드민 전용 기능입니다.';
  END IF;

  -- 현 마스터 → leader
  UPDATE public.users u
  SET role = 'leader'
  FROM public.districts d
  WHERE u.district_id = d.id
    AND d.church_id = p_church_id
    AND u.role = 'master'
    AND u.status = 'active';

  -- 대상 → master
  UPDATE public.users u
  SET role = 'master'
  FROM public.districts d
  WHERE u.district_id = d.id
    AND d.church_id = p_church_id
    AND u.id = p_new_master_id;
END;
$$;

-- ── 3. 슈퍼어드민용 교회 구성원 목록 ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_church_members_superadmin(p_church_id UUID)
RETURNS TABLE (
  id         UUID,
  name       TEXT,
  role       TEXT,
  district_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION '슈퍼어드민 전용 기능입니다.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.name::TEXT,
    u.role::TEXT,
    d.name::TEXT AS district_name
  FROM public.users u
  JOIN public.districts d ON d.id = u.district_id
  WHERE d.church_id = p_church_id
    AND u.status = 'active'
  ORDER BY
    CASE u.role WHEN 'master' THEN 0 WHEN 'leader' THEN 1 ELSE 2 END,
    u.name;
END;
$$;
