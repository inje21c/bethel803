-- ============================================================
-- 027: 교회별 설정 (church_settings)
-- - qt_mode: scraped(매일성경 스크래핑, 벧엘 전용) | admin(관리자 등록) | simple(구절+체크)
-- - modules: 기능 모듈 플래그 (예: {"bulletin_parsing": true})
-- - terms: 용어 사전 (예: {"district": "구역"})
-- 전제: 021_saas_church_scope (churches 테이블)
-- ============================================================

DO $$ BEGIN
  IF to_regclass('public.churches') IS NULL THEN
    RAISE EXCEPTION '021_saas_church_scope must be applied before 027 (churches table missing)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.church_settings (
  church_id            UUID PRIMARY KEY REFERENCES public.churches(id) ON DELETE CASCADE,
  qt_mode              TEXT NOT NULL DEFAULT 'simple',
  modules              JSONB NOT NULL DEFAULT '{}'::jsonb,
  bulletin_url_pattern TEXT,
  terms                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.church_settings
  DROP CONSTRAINT IF EXISTS church_settings_qt_mode_check;
ALTER TABLE public.church_settings
  ADD CONSTRAINT church_settings_qt_mode_check
  CHECK (qt_mode IN ('scraped', 'admin', 'simple'));

DROP TRIGGER IF EXISTS church_settings_updated_at ON public.church_settings;
CREATE TRIGGER church_settings_updated_at
  BEFORE UPDATE ON public.church_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 신규 교회 생성 시 기본 설정 자동 생성 (디폴트 simple)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_default_church_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.church_settings (church_id, qt_mode)
  VALUES (NEW.id, 'simple')
  ON CONFLICT (church_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS churches_default_settings ON public.churches;
CREATE TRIGGER churches_default_settings
  AFTER INSERT ON public.churches
  FOR EACH ROW EXECUTE FUNCTION public.create_default_church_settings();

-- ============================================================
-- 기존 교회 백필: 벧엘은 현행(scraped) 유지, 그 외는 simple
-- ============================================================
INSERT INTO public.church_settings (church_id, qt_mode, modules, bulletin_url_pattern)
SELECT
  c.id,
  CASE WHEN c.id = '00000000-0000-4100-a000-000000000001' THEN 'scraped' ELSE 'simple' END,
  CASE WHEN c.id = '00000000-0000-4100-a000-000000000001'
       THEN '{"bulletin_parsing": true}'::jsonb ELSE '{}'::jsonb END,
  CASE WHEN c.id = '00000000-0000-4100-a000-000000000001'
       THEN 'http://bethel.or.kr/wp-content/uploads/{yyyy}/{mm}/weekly{yy}{mm}{dd}.pdf' ELSE NULL END
FROM public.churches c
ON CONFLICT (church_id) DO NOTHING;

-- ============================================================
-- RLS: 같은 교회 구성원 조회, 수정은 교회 마스터만
-- ============================================================
ALTER TABLE public.church_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "church_settings_select_same_church" ON public.church_settings;
CREATE POLICY "church_settings_select_same_church" ON public.church_settings
  FOR SELECT USING (public.is_same_church(church_id));

DROP POLICY IF EXISTS "church_settings_update_master" ON public.church_settings;
CREATE POLICY "church_settings_update_master" ON public.church_settings
  FOR UPDATE USING (public.is_church_master(church_id))
  WITH CHECK (public.is_church_master(church_id));
