-- ============================================================
-- 028: qt_contents 교회 스코프 전환
-- - church_id 추가 (기존 데이터는 벧엘 귀속)
-- - date 전역 UNIQUE → (church_id, date) UNIQUE
-- - INSERT 시 호출자의 교회로 자동 귀속 (service role은 벧엘 기본값)
-- - RLS를 교회 경계로 축소 + simple 모드용 구성원 INSERT 허용
-- 전제: 021, 027
-- ============================================================

DO $$ BEGIN
  IF to_regclass('public.churches') IS NULL THEN
    RAISE EXCEPTION '021_saas_church_scope must be applied before 028 (churches table missing)';
  END IF;
END $$;

-- ============================================================
-- 1. church_id 컬럼
-- ============================================================
ALTER TABLE public.qt_contents
  ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE;

UPDATE public.qt_contents
SET church_id = '00000000-0000-4100-a000-000000000001'
WHERE church_id IS NULL;

ALTER TABLE public.qt_contents
  ALTER COLUMN church_id SET NOT NULL;

ALTER TABLE public.qt_contents
  ALTER COLUMN church_id SET DEFAULT '00000000-0000-4100-a000-000000000001';

-- ============================================================
-- 2. UNIQUE 제약: date → (church_id, date)
-- ============================================================
ALTER TABLE public.qt_contents
  DROP CONSTRAINT IF EXISTS qt_contents_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS qt_contents_church_date_unique
  ON public.qt_contents (church_id, date);

-- ============================================================
-- 3. INSERT 시 교회 자동 귀속
--    - 로그인 사용자: 본인 교회로 강제
--    - service role(스크래퍼 등, auth.uid() 없음): 명시값 또는 벧엘 기본값 유지
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_qt_content_church()
RETURNS TRIGGER AS $$
DECLARE
  v_my_church UUID;
BEGIN
  v_my_church := public.get_my_church_id();
  IF v_my_church IS NOT NULL THEN
    NEW.church_id := v_my_church;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS qt_contents_set_church ON public.qt_contents;
CREATE TRIGGER qt_contents_set_church
  BEFORE INSERT ON public.qt_contents
  FOR EACH ROW EXECUTE FUNCTION public.set_qt_content_church();

-- ============================================================
-- 4. RLS 교회 스코프
-- ============================================================

-- 조회: 활성 구성원 + 자기 교회 콘텐츠만
DROP POLICY IF EXISTS "qt_contents_select_active" ON public.qt_contents;
CREATE POLICY "qt_contents_select_active" ON public.qt_contents
  FOR SELECT USING (
    church_id = public.get_my_church_id()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND status = 'active'
    )
  );

-- 수정(leader_comment 등): 자기 교회의 리더/마스터만
DROP POLICY IF EXISTS "qt_contents_update_leader" ON public.qt_contents;
CREATE POLICY "qt_contents_update_leader" ON public.qt_contents
  FOR UPDATE USING (
    church_id = public.get_my_church_id()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('leader', 'master') AND status = 'active'
    )
  );

-- 생성: 활성 구성원이 자기 교회 콘텐츠 생성 가능 (simple 모드 lazy 생성용)
DROP POLICY IF EXISTS "qt_contents_insert_member" ON public.qt_contents;
CREATE POLICY "qt_contents_insert_member" ON public.qt_contents
  FOR INSERT WITH CHECK (
    church_id = public.get_my_church_id()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND status = 'active'
    )
  );
