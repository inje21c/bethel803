-- ============================================================
-- 025: 깊은 묵상 (4단계 묵상) 세션 테이블
-- QT 흐름의 선택적 분기: 관찰 → 질문/답변 → 느낌 → 결단
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deep_meditations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE        NOT NULL,
  state           TEXT        NOT NULL DEFAULT 'OBSERVING',

  -- 1단계: 내용관찰
  ai_summary      TEXT,
  observation     TEXT,

  -- 2단계: 연구와 묵상
  questions       JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- [{"text":"...","source":"ai"|"user"}]
  answers         JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- ["답변0", ...] questions와 같은 인덱스
  current_q_index INT         NOT NULL DEFAULT 0,

  -- 3단계: 느낌
  feelings        TEXT,

  -- 4단계: 결단과 적용
  decision        TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, date)
);

ALTER TABLE public.deep_meditations
  DROP CONSTRAINT IF EXISTS deep_meditations_state_check;
ALTER TABLE public.deep_meditations
  ADD CONSTRAINT deep_meditations_state_check
  CHECK (state IN ('OBSERVING', 'ADDING_QUESTIONS', 'ANSWERING', 'FEELING', 'DECIDING', 'DONE'));

CREATE INDEX IF NOT EXISTS deep_meditations_user_date_idx
  ON public.deep_meditations (user_id, date);

DROP TRIGGER IF EXISTS deep_meditations_updated_at ON public.deep_meditations;
CREATE TRIGGER deep_meditations_updated_at
  BEFORE UPDATE ON public.deep_meditations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- RLS: 개인 기록 — 본인만 접근 (리더/마스터도 열람 불가)
-- ============================================================
ALTER TABLE public.deep_meditations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deep_meditations_select_own" ON public.deep_meditations;
CREATE POLICY "deep_meditations_select_own" ON public.deep_meditations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "deep_meditations_insert_own" ON public.deep_meditations;
CREATE POLICY "deep_meditations_insert_own" ON public.deep_meditations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "deep_meditations_update_own" ON public.deep_meditations;
CREATE POLICY "deep_meditations_update_own" ON public.deep_meditations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "deep_meditations_delete_own" ON public.deep_meditations;
CREATE POLICY "deep_meditations_delete_own" ON public.deep_meditations
  FOR DELETE USING (auth.uid() = user_id);
