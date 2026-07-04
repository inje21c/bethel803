-- ============================================================
-- 052. 커뮤니티 컨테이너 교회 + 모임→교회 이동
-- ============================================================
-- 모임우선(group-first) 아키텍처의 첫 단계.
-- - 일반 사용자 모임을 담는 단일 컨테이너 교회 "커뮤니티" 생성
-- - 사용자가 있는 구역(district)을 다른 교회로 옮기는 슈퍼어드민 RPC
--   (prevent_district_church_change / enforce_user_scope_change 트리거 우회)
-- - 어제 잘못 유입된 테스트구역(벧엘 밑)을 커뮤니티 컨테이너로 일회성 이동
-- 설계: docs/기능설계/모임우선_아키텍처_재설계.md
-- ============================================================

-- ============================================================
-- 1. plan CHECK 확장: 'community' 추가
-- ============================================================
ALTER TABLE public.churches
  DROP CONSTRAINT IF EXISTS churches_plan_check;
ALTER TABLE public.churches
  ADD CONSTRAINT churches_plan_check
  CHECK (plan IN ('legacy', 'free', 'community', 'starter', 'standard', 'premium'));

-- ============================================================
-- 2. 커뮤니티 컨테이너 교회 (고정 UUID, 만료 없음, master 없음)
-- ============================================================
-- church_settings는 churches_default_settings(AFTER INSERT) 트리거가 자동 생성.
INSERT INTO public.churches (id, name, slug, status, plan, billing_status, trial_ends_at)
VALUES (
  '00000000-0000-4100-a000-000000000002',
  '커뮤니티',
  'community',
  'active',
  'community',
  'manual',
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. 모임→교회 이동 RPC (슈퍼어드민 전용, graduate/통합 공용)
-- ============================================================
-- 구역과 그 구역 소속 모든 사용자의 church_id를 함께 옮긴다.
-- prevent_district_church_change_with_users / enforce_user_scope_change /
-- sync_user_church 트리거를 일시 비활성(USER) 후 재활성한다.
DROP FUNCTION IF EXISTS public.move_district_to_church(UUID, UUID);
CREATE OR REPLACE FUNCTION public.move_district_to_church(
  p_district_id     UUID,
  p_target_church_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.churches WHERE id = p_target_church_id)
    INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Target church not found: %', p_target_church_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.districts WHERE id = p_district_id) THEN
    RAISE EXCEPTION 'District not found: %', p_district_id;
  END IF;

  -- 가드 트리거 일시 해제 (이 함수는 owner 권한으로 ALTER 가능)
  ALTER TABLE public.districts DISABLE TRIGGER USER;
  ALTER TABLE public.users     DISABLE TRIGGER USER;

  UPDATE public.districts
     SET church_id = p_target_church_id
   WHERE id = p_district_id;

  UPDATE public.users
     SET church_id = p_target_church_id
   WHERE district_id = p_district_id;

  ALTER TABLE public.users     ENABLE TRIGGER USER;
  ALTER TABLE public.districts ENABLE TRIGGER USER;
END;
$$;

REVOKE ALL ON FUNCTION public.move_district_to_church(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_district_to_church(UUID, UUID) TO authenticated;

-- ============================================================
-- 4. 일회성: 테스트구역(벧엘 밑) → 커뮤니티 컨테이너 이동
-- ============================================================
-- 어제 베타에서 잘못 유입된 구역. idempotent: 이미 옮겨졌으면 no-op.
-- 트리거를 직접 우회(USER 비활성)하여 마이그레이션 owner 권한으로 이동.
-- 추가: 구성원K(타구역, pending, 테스트 참여자)를 테스트구역 구역원으로 먼저
--       옮긴 뒤, 테스트구역과 함께 커뮤니티로 이동시킨다.
DO $$
DECLARE
  v_district  UUID := 'ba2ea0f1-fa4b-4b04-b930-ad27c6919359'; -- 테스트구역
  v_bethel    UUID := '00000000-0000-4100-a000-000000000001';
  v_community UUID := '00000000-0000-4100-a000-000000000002';
  v_member_k  UUID := 'cc11f2a8-f7a6-495f-8b22-5ceb3b50c257'; -- 구성원K
BEGIN
  -- 현재 벧엘 밑에 있을 때만 이동 (안전 가드)
  IF EXISTS (
    SELECT 1 FROM public.districts
    WHERE id = v_district AND church_id = v_bethel
  ) THEN
    ALTER TABLE public.districts DISABLE TRIGGER USER;
    ALTER TABLE public.users     DISABLE TRIGGER USER;

    -- 구성원K를 타구역 → 테스트구역으로 (같은 교회 내 구역 이동, role/status 유지)
    UPDATE public.users
       SET district_id = v_district
     WHERE id = v_member_k AND church_id = v_bethel;

    -- 테스트구역 + 소속 사용자 전원(구성원K 포함) → 커뮤니티
    UPDATE public.districts SET church_id = v_community WHERE id = v_district;
    UPDATE public.users SET church_id = v_community WHERE district_id = v_district;

    ALTER TABLE public.users     ENABLE TRIGGER USER;
    ALTER TABLE public.districts ENABLE TRIGGER USER;
  END IF;
END $$;
