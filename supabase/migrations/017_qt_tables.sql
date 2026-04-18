-- ============================================================
-- 017: QT (오늘의 묵상) 기능 테이블
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

-- ============================================================
-- 1. qt_contents: 날짜별 묵상 패키지
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qt_contents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date              DATE        UNIQUE NOT NULL,
  title             TEXT,
  scripture         TEXT,
  scripture_text    TEXT,
  summary           TEXT,
  question          TEXT,
  audio_url         TEXT,
  hymn_suggestions  JSONB,
  leader_comment    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. qt_responses: 구역원 응답
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qt_responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id    UUID        NOT NULL REFERENCES public.qt_contents(id) ON DELETE CASCADE,
  answer        TEXT,
  is_completed  BOOLEAN     NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  is_past_day   BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- ============================================================
-- 3. streaks: 연속 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS public.streaks (
  user_id             UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak      INT   NOT NULL DEFAULT 0,
  max_streak          INT   NOT NULL DEFAULT 0,
  last_completed_date DATE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. RLS 활성화
-- ============================================================
ALTER TABLE public.qt_contents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qt_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks      ENABLE ROW LEVEL SECURITY;

-- qt_contents: 활성 구역원 조회
CREATE POLICY "qt_contents_select_active" ON public.qt_contents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'active')
  );

-- qt_contents: 구역장/마스터 leader_comment 수정
CREATE POLICY "qt_contents_update_leader" ON public.qt_contents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('leader', 'master'))
  );

-- qt_responses: 본인 CRUD
CREATE POLICY "qt_responses_own" ON public.qt_responses
  FOR ALL USING (user_id = auth.uid());

-- qt_responses: 구역장/마스터 전체 조회
CREATE POLICY "qt_responses_leader_select" ON public.qt_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('leader', 'master'))
  );

-- streaks: 본인 CRUD
CREATE POLICY "streaks_own" ON public.streaks
  FOR ALL USING (user_id = auth.uid());

-- streaks: 구역장/마스터 전체 조회
CREATE POLICY "streaks_leader_select" ON public.streaks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('leader', 'master'))
  );

-- ============================================================
-- 5. 구역 QT 현황 조회 RPC (구역장 대시보드)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_qt_district_summary(
  p_district_id UUID,
  p_date        DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Seoul')::DATE
)
RETURNS TABLE(
  user_id        UUID,
  user_name      TEXT,
  is_completed   BOOLEAN,
  current_streak INT,
  last_completed DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    u.id                                AS user_id,
    u.name                              AS user_name,
    COALESCE(qr.is_completed, false)    AS is_completed,
    COALESCE(st.current_streak, 0)      AS current_streak,
    st.last_completed_date              AS last_completed
  FROM public.users u
  LEFT JOIN public.qt_contents qc ON qc.date = p_date
  LEFT JOIN public.qt_responses qr ON qr.user_id = u.id AND qr.content_id = qc.id
  LEFT JOIN public.streaks st ON st.user_id = u.id
  WHERE u.district_id = p_district_id
    AND u.status = 'active'
  ORDER BY is_completed DESC, u.name;
$$;

REVOKE ALL ON FUNCTION public.get_qt_district_summary(UUID, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_qt_district_summary(UUID, DATE) TO authenticated;
