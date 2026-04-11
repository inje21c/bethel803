-- ============================================================
-- 014: 성경공부 원본/수정본 구조 개편 초안
-- study_sources: 파싱 원본 1건
-- bible_studies: 구역별 수정본/발행본
--
-- 주의:
-- - 이 초안은 기존 bible_studies 데이터를 삭제하지 않는다.
-- - 과거 데이터는 source_id 없이 유지될 수 있다.
-- - parse-bulletin 함수와 관리자 UI 변경이 함께 따라와야 한다.
-- ============================================================

-- ============================================================
-- 1. study_sources 테이블 생성
-- ============================================================

CREATE TABLE IF NOT EXISTS public.study_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_date DATE NOT NULL UNIQUE,
  week_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  scripture TEXT NOT NULL DEFAULT '',
  introduction TEXT NOT NULL DEFAULT '',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_pdf_url TEXT,
  parse_mode TEXT NOT NULL DEFAULT 'auto',
  parsed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.study_sources
  DROP CONSTRAINT IF EXISTS study_sources_parse_mode_check;

ALTER TABLE public.study_sources
  ADD CONSTRAINT study_sources_parse_mode_check
  CHECK (parse_mode IN ('auto', 'manual'));

DROP TRIGGER IF EXISTS study_sources_updated_at ON public.study_sources;
CREATE TRIGGER study_sources_updated_at
  BEFORE UPDATE ON public.study_sources
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS study_sources_created_idx
  ON public.study_sources (created_at DESC);

CREATE INDEX IF NOT EXISTS study_sources_week_number_idx
  ON public.study_sources (week_number, study_date DESC);

ALTER TABLE public.study_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_sources_select_leader" ON public.study_sources;
CREATE POLICY "study_sources_select_leader" ON public.study_sources
  FOR SELECT USING (public.is_master() OR public.is_leader());

DROP POLICY IF EXISTS "study_sources_insert_leader" ON public.study_sources;
CREATE POLICY "study_sources_insert_leader" ON public.study_sources
  FOR INSERT WITH CHECK (public.is_master() OR public.is_leader());

DROP POLICY IF EXISTS "study_sources_update_master" ON public.study_sources;
CREATE POLICY "study_sources_update_master" ON public.study_sources
  FOR UPDATE USING (public.is_master())
  WITH CHECK (public.is_master());

DROP POLICY IF EXISTS "study_sources_delete_master" ON public.study_sources;
CREATE POLICY "study_sources_delete_master" ON public.study_sources
  FOR DELETE USING (public.is_master());

-- ============================================================
-- 2. bible_studies 확장
-- ============================================================

ALTER TABLE public.bible_studies
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.study_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS bible_studies_source_id_idx
  ON public.bible_studies (source_id);

-- 같은 구역에서 같은 원본에 대한 수정본은 1건만 허용한다.
-- source_id가 NULL인 기존 데이터는 중복 허용된다.
DROP INDEX IF EXISTS bible_studies_district_source_unique;
CREATE UNIQUE INDEX IF NOT EXISTS bible_studies_district_source_unique
  ON public.bible_studies (district_id, source_id)
  WHERE source_id IS NOT NULL;

-- ============================================================
-- 3. 원본 -> 수정본 생성용 헬퍼 함수
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_bible_study_from_source(
  p_source_id UUID,
  p_district_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_source public.study_sources%ROWTYPE;
  v_district_id UUID;
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  IF NOT (public.is_master() OR public.is_leader()) THEN
    RAISE EXCEPTION 'Unauthorized: leader only';
  END IF;

  IF p_district_id IS NOT NULL THEN
    v_district_id := p_district_id;
  ELSE
    v_district_id := public.get_my_district_id();
  END IF;

  SELECT * INTO v_source
  FROM public.study_sources
  WHERE id = p_source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'study source not found';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.bible_studies
  WHERE district_id = v_district_id
    AND source_id = p_source_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.bible_studies (
    week_number,
    study_date,
    title,
    scripture,
    introduction,
    questions,
    published,
    district_id,
    source_pdf_url,
    source_id,
    source_snapshot
  ) VALUES (
    v_source.week_number,
    v_source.study_date,
    v_source.title,
    v_source.scripture,
    v_source.introduction,
    v_source.questions,
    false,
    v_district_id,
    v_source.source_pdf_url,
    v_source.id,
    jsonb_build_object(
      'study_date', v_source.study_date,
      'week_number', v_source.week_number,
      'title', v_source.title,
      'scripture', v_source.scripture,
      'introduction', v_source.introduction,
      'questions', v_source.questions,
      'source_pdf_url', v_source.source_pdf_url
    )
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. 운영 메모
-- ============================================================
-- parse-bulletin 함수는 bible_studies에 직접 insert 하지 않고
-- study_sources에 원본 1건만 생성하도록 변경해야 한다.
--
-- 동일 study_date의 원본이 이미 존재하면 409 Conflict로 반환한다.
