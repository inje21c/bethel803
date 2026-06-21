-- ============================================================
-- 050. 베타 모듈 전역 플래그
-- ============================================================
-- 오픈 전 베타 기간 동안 특정 모듈(성경읽기 본문, QT 깊은 묵상 등)을
-- 모든 가입자에게 한시 개방한다. 슈퍼어드민이 토글로 켜고 끈다.
-- church 단위가 아닌 서비스 전역 플래그.

CREATE TABLE IF NOT EXISTS public.beta_flags (
  module     TEXT PRIMARY KEY,
  enabled    BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_flags ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자는 읽기 가능 (게이팅 판정에 필요).
DROP POLICY IF EXISTS "beta_flags_authenticated_read" ON public.beta_flags;
CREATE POLICY "beta_flags_authenticated_read" ON public.beta_flags
  FOR SELECT TO authenticated
  USING (true);

-- 직접 INSERT/UPDATE/DELETE는 차단. 변경은 슈퍼어드민 RPC로만.
-- (정책을 만들지 않으면 RLS에 의해 기본 차단됨)

-- 기본 베타 모듈 시드 (성경읽기 본문 / QT 깊은 묵상)
INSERT INTO public.beta_flags (module, enabled) VALUES
  ('bible_text', true),
  ('deep_meditation', true)
ON CONFLICT (module) DO NOTHING;

-- 전체 플래그 조회 (인증 사용자 누구나)
DROP FUNCTION IF EXISTS public.get_beta_flags();
CREATE OR REPLACE FUNCTION public.get_beta_flags()
RETURNS TABLE (module TEXT, enabled BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT module, enabled FROM public.beta_flags ORDER BY module;
$$;

-- 플래그 토글 (슈퍼어드민 전용)
DROP FUNCTION IF EXISTS public.set_beta_flag(TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.set_beta_flag(
  p_module  TEXT,
  p_enabled BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() IS DISTINCT FROM 'cmhyun@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.beta_flags (module, enabled, updated_at)
  VALUES (p_module, p_enabled, now())
  ON CONFLICT (module)
  DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
END;
$$;
