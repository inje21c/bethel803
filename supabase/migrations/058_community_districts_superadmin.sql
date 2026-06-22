-- ============================================================
-- 058. 슈퍼어드민 커뮤니티 모임 운영 (목록 + 교회 승격)
-- ============================================================
-- 커뮤니티 컨테이너(...0002)는 master가 없어 일반 RLS로는 운영 가시성이 없다.
-- 콘텐츠는 안 보고 메타데이터만 보는 슈퍼어드민 전용 조회 + 승격 RPC.
-- 설계: docs/기능설계/모임우선_아키텍처_재설계.md (8장)
-- ============================================================

-- 1) 커뮤니티 모임 목록 (메타데이터만 — 기도제목 등 콘텐츠 미포함)
CREATE OR REPLACE FUNCTION public.get_community_districts_superadmin()
RETURNS TABLE (
  district_id  UUID,
  name         TEXT,
  is_active    BOOLEAN,
  created_at   TIMESTAMPTZ,
  leader_name  TEXT,
  member_count BIGINT,
  pending_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.name::TEXT,
    d.is_active,
    d.created_at,
    (SELECT u.name::TEXT FROM public.users u
       WHERE u.district_id = d.id AND u.role = 'leader'
       ORDER BY u.created_at LIMIT 1) AS leader_name,
    (SELECT count(*) FROM public.users u
       WHERE u.district_id = d.id AND u.status = 'active')  AS member_count,
    (SELECT count(*) FROM public.users u
       WHERE u.district_id = d.id AND u.status = 'pending') AS pending_count
  FROM public.districts d
  WHERE d.church_id = '00000000-0000-4100-a000-000000000002'
  ORDER BY d.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_community_districts_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_districts_superadmin() TO authenticated;

-- 2) 모임 → 새 교회로 승격 (분리): 새 교회 생성 + 구역·구성원 이동 + 리더를 master로 승격
DROP FUNCTION IF EXISTS public.graduate_district_to_new_church(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.graduate_district_to_new_church(
  p_district_id UUID,
  p_church_name TEXT,
  p_plan        TEXT DEFAULT 'free'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community UUID := '00000000-0000-4100-a000-000000000002';
  v_church    UUID;
  v_slug      TEXT;
  v_leader    UUID;
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_church_name IS NULL OR trim(p_church_name) = '' THEN
    RAISE EXCEPTION '교회 이름이 필요합니다';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.districts WHERE id = p_district_id AND church_id = v_community) THEN
    RAISE EXCEPTION '커뮤니티 컨테이너 소속 모임이 아닙니다';
  END IF;

  v_slug := public.generate_church_slug(p_church_name);
  INSERT INTO public.churches (name, slug, status, plan, billing_status, trial_ends_at)
  VALUES (trim(p_church_name), v_slug, 'active', p_plan, 'manual', NULL)
  RETURNING id INTO v_church;

  -- 승격할 master = 해당 모임의 가장 오래된 leader
  SELECT id INTO v_leader
  FROM public.users
  WHERE district_id = p_district_id AND role = 'leader'
  ORDER BY created_at LIMIT 1;

  -- 가드 트리거 우회 후 구역+구성원 이동, 리더 승격
  ALTER TABLE public.districts DISABLE TRIGGER USER;
  ALTER TABLE public.users     DISABLE TRIGGER USER;

  UPDATE public.districts SET church_id = v_church WHERE id = p_district_id;
  UPDATE public.users SET church_id = v_church WHERE district_id = p_district_id;
  IF v_leader IS NOT NULL THEN
    UPDATE public.users SET role = 'master' WHERE id = v_leader;
  END IF;

  ALTER TABLE public.users     ENABLE TRIGGER USER;
  ALTER TABLE public.districts ENABLE TRIGGER USER;

  RETURN v_church;
END;
$$;

REVOKE ALL ON FUNCTION public.graduate_district_to_new_church(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.graduate_district_to_new_church(UUID, TEXT, TEXT) TO authenticated;
