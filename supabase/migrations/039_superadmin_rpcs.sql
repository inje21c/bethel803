-- ============================================================
-- 039. 슈퍼어드민 전용 RPC
-- ============================================================
-- 모든 함수는 내부에서 auth.email() = 'cmhyun@gmail.com' 검증.
-- RLS 우회가 필요하므로 SECURITY DEFINER 사용.

-- 1. 전체 교회 목록 조회
DROP FUNCTION IF EXISTS public.get_all_churches_superadmin();
CREATE OR REPLACE FUNCTION public.get_all_churches_superadmin()
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  slug          TEXT,
  status        TEXT,
  plan          TEXT,
  billing_status TEXT,
  trial_ends_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ,
  ui_mode       TEXT,
  district_count BIGINT,
  member_count  BIGINT
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
  SELECT
    c.id,
    c.name,
    c.slug,
    c.status,
    c.plan,
    c.billing_status,
    c.trial_ends_at,
    c.created_at,
    COALESCE(cs.ui_mode, 'full') AS ui_mode,
    COUNT(DISTINCT d.id)         AS district_count,
    COUNT(DISTINCT u.id)         AS member_count
  FROM public.churches c
  LEFT JOIN public.church_settings cs ON cs.church_id = c.id
  LEFT JOIN public.districts d ON d.church_id = c.id AND d.is_active = true
  LEFT JOIN public.users u
    ON u.district_id = d.id AND u.status = 'active'
  GROUP BY c.id, c.name, c.slug, c.status, c.plan, c.billing_status,
           c.trial_ends_at, c.created_at, cs.ui_mode
  ORDER BY c.created_at DESC;
END;
$$;

-- 2. 교회 정보 수정
CREATE OR REPLACE FUNCTION public.update_church_superadmin(
  p_church_id     UUID,
  p_plan          TEXT,
  p_status        TEXT,
  p_billing_status TEXT,
  p_trial_ends_at TIMESTAMPTZ,
  p_ui_mode       TEXT
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
  SET ui_mode = p_ui_mode
  WHERE church_id = p_church_id;
END;
$$;
