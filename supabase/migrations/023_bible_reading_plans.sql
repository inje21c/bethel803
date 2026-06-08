-- ============================================================
-- 023: 성경 읽기표 및 읽기 기록 출처 확장
-- ============================================================

ALTER TABLE public.bible_reading_logs
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'plan')),
  ADD COLUMN IF NOT EXISTS source_label TEXT,
  ADD COLUMN IF NOT EXISTS plan_id UUID,
  ADD COLUMN IF NOT EXISTS plan_day_id UUID;

CREATE TABLE IF NOT EXISTS public.bible_reading_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID,
  owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT '개역개정',
  scope TEXT NOT NULL CHECK (scope IN ('all', 'old', 'new', 'custom')),
  mode TEXT NOT NULL DEFAULT 'sequential' CHECK (mode IN ('sequential')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_chapter_target INTEGER CHECK (daily_chapter_target IS NULL OR daily_chapter_target > 0),
  total_chapters INTEGER NOT NULL CHECK (total_chapters > 0),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bible_reading_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.bible_reading_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  scheduled_date DATE NOT NULL,
  chapter_count INTEGER NOT NULL CHECK (chapter_count > 0),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, day_number),
  UNIQUE(plan_id, scheduled_date)
);

CREATE TABLE IF NOT EXISTS public.bible_reading_plan_day_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_day_id UUID NOT NULL REFERENCES public.bible_reading_plan_days(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.bible_reading_plans(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  book_id SMALLINT NOT NULL REFERENCES public.bible_books(id) ON DELETE CASCADE,
  chapter INTEGER NOT NULL CHECK (chapter > 0),
  completed_at TIMESTAMPTZ,
  reading_log_id UUID REFERENCES public.bible_reading_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, book_id, chapter)
);

ALTER TABLE public.bible_reading_logs
  DROP CONSTRAINT IF EXISTS bible_reading_logs_plan_id_fkey,
  ADD CONSTRAINT bible_reading_logs_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES public.bible_reading_plans(id) ON DELETE SET NULL;

ALTER TABLE public.bible_reading_logs
  DROP CONSTRAINT IF EXISTS bible_reading_logs_plan_day_id_fkey,
  ADD CONSTRAINT bible_reading_logs_plan_day_id_fkey
    FOREIGN KEY (plan_day_id) REFERENCES public.bible_reading_plan_days(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bible_reading_logs_plan_day_once
  ON public.bible_reading_logs(user_id, plan_day_id)
  WHERE source_type = 'plan' AND plan_day_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bible_reading_plans_owner
  ON public.bible_reading_plans(owner_user_id, status, is_primary DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bible_reading_plan_days_plan_date
  ON public.bible_reading_plan_days(plan_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_bible_reading_plan_day_items_plan
  ON public.bible_reading_plan_day_items(plan_id, book_id, chapter);

DROP TRIGGER IF EXISTS bible_reading_plans_updated_at ON public.bible_reading_plans;
CREATE TRIGGER bible_reading_plans_updated_at
  BEFORE UPDATE ON public.bible_reading_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.bible_reading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_reading_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_reading_plan_day_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bible_reading_plans_own" ON public.bible_reading_plans;
CREATE POLICY "bible_reading_plans_own" ON public.bible_reading_plans
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "bible_reading_plan_days_own" ON public.bible_reading_plan_days;
CREATE POLICY "bible_reading_plan_days_own" ON public.bible_reading_plan_days
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bible_reading_plans p
      WHERE p.id = bible_reading_plan_days.plan_id
        AND p.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bible_reading_plans p
      WHERE p.id = bible_reading_plan_days.plan_id
        AND p.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bible_reading_plan_day_items_own" ON public.bible_reading_plan_day_items;
CREATE POLICY "bible_reading_plan_day_items_own" ON public.bible_reading_plan_day_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bible_reading_plans p
      WHERE p.id = bible_reading_plan_day_items.plan_id
        AND p.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bible_reading_plans p
      WHERE p.id = bible_reading_plan_day_items.plan_id
        AND p.owner_user_id = auth.uid()
    )
  );
