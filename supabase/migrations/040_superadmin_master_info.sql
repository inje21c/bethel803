-- ============================================================
-- 040. 슈퍼어드민 RPC에 마스터 계정 정보 추가
-- ============================================================
-- get_all_churches_superadmin에 master_id / master_name / master_email 포함.
-- auth.users는 SECURITY DEFINER 함수에서만 접근 가능.

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
      u.id         AS user_id,
      u.name::TEXT AS user_name,
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
           c.trial_ends_at, c.created_at, cs.ui_mode,
           mu.user_id, mu.user_name, mu.user_email
  ORDER BY c.created_at DESC;
END;
$$;
