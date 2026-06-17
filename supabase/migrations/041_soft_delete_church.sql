-- ============================================================
-- 041. 교회 소프트 딜리트 (마스터 탈퇴 시 30일 유예)
-- ============================================================

-- 1. churches에 deleted_at 컬럼 추가
ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. get_my_church_info() — deleted_at 포함하도록 교체
DROP FUNCTION IF EXISTS public.get_my_church_info();
CREATE OR REPLACE FUNCTION public.get_my_church_info()
RETURNS TABLE (
  id             UUID,
  name           TEXT,
  slug           TEXT,
  status         TEXT,
  plan           TEXT,
  billing_status TEXT,
  trial_ends_at  TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name::TEXT, c.slug::TEXT, c.status::TEXT,
         c.plan::TEXT, c.billing_status::TEXT,
         c.trial_ends_at, c.deleted_at
  FROM public.churches c
  WHERE c.id = public.get_my_church_id();
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_church_info() TO authenticated;

-- 3. 마스터 소프트 딜리트 — Edge Function에서 service role로 직접 UPDATE하므로
--    별도 RPC 불필요. 단, 슈퍼어드민 복구/영구삭제 RPC는 필요.

-- 4. 슈퍼어드민: 교회 복구 (deleted_at 제거)
CREATE OR REPLACE FUNCTION public.restore_church_superadmin(p_church_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.churches SET deleted_at = NULL WHERE id = p_church_id;
END;
$$;

-- 5. 슈퍼어드민: 교회 영구 삭제 (30일 경과 후 수동 실행)
CREATE OR REPLACE FUNCTION public.hard_delete_church_superadmin(p_church_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  -- deleted_at이 설정된 교회만 영구 삭제 허용
  IF NOT EXISTS (
    SELECT 1 FROM public.churches WHERE id = p_church_id AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION '삭제 예정 상태가 아닌 교회는 영구 삭제할 수 없습니다';
  END IF;
  -- auth.users 삭제는 Edge Function에서 처리 (service_role 필요)
  -- 여기서는 DB 데이터만 삭제 (CASCADE 적용)
  DELETE FROM public.churches WHERE id = p_church_id;
END;
$$;

-- 6. get_all_churches_superadmin() — deleted_at 포함하도록 교체
DROP FUNCTION IF EXISTS public.get_all_churches_superadmin();
CREATE OR REPLACE FUNCTION public.get_all_churches_superadmin()
RETURNS TABLE (
  id             UUID,
  name           TEXT,
  slug           TEXT,
  status         TEXT,
  plan           TEXT,
  billing_status  TEXT,
  trial_ends_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ,
  ui_mode        TEXT,
  district_count BIGINT,
  member_count   BIGINT,
  master_id      UUID,
  master_name    TEXT,
  master_email   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH master_users AS (
    SELECT DISTINCT ON (d.church_id)
      d.church_id,
      u.id           AS user_id,
      u.name::TEXT   AS user_name,
      au.email::TEXT AS user_email
    FROM public.users u
    JOIN public.districts d ON d.id = u.district_id
    JOIN auth.users au ON au.id = u.id
    WHERE u.role = 'master' AND u.status = 'active'
    ORDER BY d.church_id, u.created_at
  )
  SELECT
    c.id,
    c.name::TEXT,
    c.slug::TEXT,
    c.status::TEXT,
    c.plan::TEXT,
    c.billing_status::TEXT,
    c.trial_ends_at,
    c.created_at,
    c.deleted_at,
    COALESCE(cs.ui_mode, 'full')::TEXT AS ui_mode,
    COUNT(DISTINCT d.id)               AS district_count,
    COUNT(DISTINCT u.id)               AS member_count,
    mu.user_id                         AS master_id,
    mu.user_name                       AS master_name,
    mu.user_email                      AS master_email
  FROM public.churches c
  LEFT JOIN public.church_settings cs ON cs.church_id = c.id
  LEFT JOIN public.districts d  ON d.church_id = c.id AND d.is_active = true
  LEFT JOIN public.users u      ON u.district_id = d.id AND u.status = 'active'
  LEFT JOIN master_users mu     ON mu.church_id = c.id
  GROUP BY c.id, c.name, c.slug, c.status, c.plan, c.billing_status,
           c.trial_ends_at, c.created_at, c.deleted_at, cs.ui_mode,
           mu.user_id, mu.user_name, mu.user_email
  ORDER BY c.deleted_at NULLS LAST, c.created_at DESC;
END;
$$;
