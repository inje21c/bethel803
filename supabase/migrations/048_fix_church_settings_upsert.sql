-- migration 048: update_church_superadmin church_settings upsert 수정
-- 기존 UPDATE는 church_settings 행이 없는 교회에서 silent no-op 발생
-- INSERT ... ON CONFLICT DO UPDATE 로 교체

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

  -- church_settings 행이 없는 교회도 안전하게 처리
  INSERT INTO public.church_settings (church_id, ui_mode, qt_mode)
  VALUES (p_church_id, p_ui_mode, p_qt_mode)
  ON CONFLICT (church_id) DO UPDATE
    SET ui_mode = EXCLUDED.ui_mode,
        qt_mode = EXCLUDED.qt_mode;
END;
$$;
