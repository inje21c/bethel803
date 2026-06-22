-- ============================================================
-- 059. 슈퍼어드민 커뮤니티 모임 구성원 관리 (목록/역할/승인)
-- ============================================================
-- 커뮤니티 컨테이너(...0002)는 master가 없어, enforce_role_change 트리거 때문에
-- 어떤 경로로도 커뮤니티 모임의 역할을 바꿀 수 없는 공백이 있었다.
-- 슈퍼어드민 전용 RPC로 구성원 목록 조회 + 역할(leader/member) 변경 + 승인을 제공.
-- 역할 변경은 SECURITY DEFINER + 트리거 우회로 처리.
-- 설계: docs/기능설계/모임우선_아키텍처_재설계.md (8장)
-- ============================================================

-- 1) 모임 구성원 목록 (메타데이터 + 이메일)
CREATE OR REPLACE FUNCTION public.get_community_district_members_superadmin(p_district_id UUID)
RETURNS TABLE (user_id UUID, name TEXT, email TEXT, role TEXT, status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.districts
    WHERE id = p_district_id AND church_id = '00000000-0000-4100-a000-000000000002'
  ) THEN
    RAISE EXCEPTION '커뮤니티 컨테이너 소속 모임이 아닙니다';
  END IF;

  RETURN QUERY
  SELECT u.id, u.name::TEXT, au.email::TEXT, u.role::TEXT, u.status::TEXT, u.created_at
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.district_id = p_district_id
  ORDER BY u.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_community_district_members_superadmin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_district_members_superadmin(UUID) TO authenticated;

-- 2) 역할 변경 (leader/member) — 트리거 우회
DROP FUNCTION IF EXISTS public.set_community_member_role_superadmin(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.set_community_member_role_superadmin(p_user_id UUID, p_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_community UUID := '00000000-0000-4100-a000-000000000002';
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_role NOT IN ('leader', 'member') THEN
    RAISE EXCEPTION '역할은 leader 또는 member만 가능합니다';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND church_id = v_community) THEN
    RAISE EXCEPTION '커뮤니티 컨테이너 구성원이 아닙니다';
  END IF;

  ALTER TABLE public.users DISABLE TRIGGER USER;
  UPDATE public.users SET role = p_role WHERE id = p_user_id;
  ALTER TABLE public.users ENABLE TRIGGER USER;
END;
$$;

REVOKE ALL ON FUNCTION public.set_community_member_role_superadmin(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_community_member_role_superadmin(UUID, TEXT) TO authenticated;

-- 3) 승인 (pending → active)
CREATE OR REPLACE FUNCTION public.approve_community_member_superadmin(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_community UUID := '00000000-0000-4100-a000-000000000002';
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND church_id = v_community) THEN
    RAISE EXCEPTION '커뮤니티 컨테이너 구성원이 아닙니다';
  END IF;
  UPDATE public.users SET status = 'active' WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_community_member_superadmin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_community_member_superadmin(UUID) TO authenticated;
