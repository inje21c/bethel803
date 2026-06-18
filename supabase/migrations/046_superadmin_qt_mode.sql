-- ============================================================
-- 046. 슈퍼어드민 QT 모드 관리
-- ============================================================
-- get_all_churches_superadmin: qt_mode 컬럼 추가
-- update_church_superadmin: p_qt_mode 파라미터 추가

-- 1. 전체 교회 목록 조회 (qt_mode 포함)
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
  ui_mode        TEXT,
  qt_mode        TEXT,
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
    COALESCE(cs.ui_mode, 'full')::TEXT   AS ui_mode,
    COALESCE(cs.qt_mode, 'simple')::TEXT AS qt_mode,
    COUNT(DISTINCT d.id)                  AS district_count,
    COUNT(DISTINCT u.id)                  AS member_count,
    mu.user_id                            AS master_id,
    mu.user_name                          AS master_name,
    mu.user_email                         AS master_email
  FROM public.churches c
  LEFT JOIN public.church_settings cs ON cs.church_id = c.id
  LEFT JOIN public.districts d  ON d.church_id = c.id AND d.is_active = true
  LEFT JOIN public.users u      ON u.district_id = d.id AND u.status = 'active'
  LEFT JOIN master_users mu     ON mu.church_id = c.id
  GROUP BY c.id, c.name, c.slug, c.status, c.plan, c.billing_status,
           c.trial_ends_at, c.created_at, cs.ui_mode, cs.qt_mode,
           mu.user_id, mu.user_name, mu.user_email
  ORDER BY c.created_at DESC;
END;
$$;

-- 2. 교회 정보 수정 (qt_mode 포함)
CREATE OR REPLACE FUNCTION public.update_church_superadmin(
  p_church_id      UUID,
  p_plan           TEXT,
  p_status         TEXT,
  p_billing_status TEXT,
  p_trial_ends_at  TIMESTAMPTZ,
  p_ui_mode        TEXT,
  p_qt_mode        TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.churches
  SET
    plan           = p_plan,
    status         = p_status,
    billing_status = p_billing_status,
    trial_ends_at  = p_trial_ends_at
  WHERE id = p_church_id;

  UPDATE public.church_settings
  SET
    ui_mode = p_ui_mode,
    qt_mode = p_qt_mode
  WHERE church_id = p_church_id;
END;
$$;
