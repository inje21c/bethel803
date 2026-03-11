-- ============================================================
-- 003_safe_apply.sql
-- 이미 일부 테이블이 생성된 상태에서 안전하게 전체 스키마 적용
-- 트리거·정책을 DROP IF EXISTS 후 재생성 → 중복 에러 없음
-- ============================================================

-- ============================================================
-- 함수 (CREATE OR REPLACE → 항상 안전)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 테이블 (IF NOT EXISTS → 항상 안전)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bible_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  scripture TEXT NOT NULL,
  introduction TEXT NOT NULL DEFAULT '',
  questions JSONB NOT NULL DEFAULT '[]',
  study_date DATE NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.bible_studies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(study_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  response TEXT,
  answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bible_reading_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  chapters INTEGER NOT NULL CHECK (chapters > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  schedule_date DATE NOT NULL,
  schedule_time TEXT,
  location TEXT,
  memo TEXT,
  attendance_check BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attending', 'absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(schedule_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.daily_devotionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devotional_date DATE NOT NULL UNIQUE,
  scripture TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  application_question TEXT,
  audio_url TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  attendance_count INTEGER,
  attendance_names TEXT[],
  bible_chapters_total INTEGER,
  study_completion_count INTEGER,
  report_text TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 트리거 (DROP IF EXISTS → 안전하게 재생성)
-- ============================================================
DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS bible_studies_updated_at ON public.bible_studies;
CREATE TRIGGER bible_studies_updated_at
  BEFORE UPDATE ON public.bible_studies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS study_answers_updated_at ON public.study_answers;
CREATE TRIGGER study_answers_updated_at
  BEFORE UPDATE ON public.study_answers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS prayer_requests_updated_at ON public.prayer_requests;
CREATE TRIGGER prayer_requests_updated_at
  BEFORE UPDATE ON public.prayer_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS bible_reading_logs_updated_at ON public.bible_reading_logs;
CREATE TRIGGER bible_reading_logs_updated_at
  BEFORE UPDATE ON public.bible_reading_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS schedules_updated_at ON public.schedules;
CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS attendances_updated_at ON public.attendances;
CREATE TRIGGER attendances_updated_at
  BEFORE UPDATE ON public.attendances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS daily_devotionals_updated_at ON public.daily_devotionals;
CREATE TRIGGER daily_devotionals_updated_at
  BEFORE UPDATE ON public.daily_devotionals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS weekly_reports_updated_at ON public.weekly_reports;
CREATE TRIGGER weekly_reports_updated_at
  BEFORE UPDATE ON public.weekly_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- auth.users 가입 시 public.users 자동 생성 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_role TEXT;
  user_status TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  IF NEW.email = 'bethel803leader@gmail.com' THEN
    user_role := 'leader';
    user_status := 'active';
  ELSIF (SELECT COUNT(*) FROM public.users) = 0 THEN
    user_role := 'leader';
    user_status := 'active';
  ELSE
    user_role := 'member';
    user_status := 'pending';
  END IF;

  INSERT INTO public.users (id, name, role, status)
  VALUES (NEW.id, user_name, user_role, user_status)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS 활성화 (이미 켜져 있어도 에러 없음)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_devotionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS 헬퍼 함수 (재귀 방지용 SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_leader()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_active()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS 정책 (DROP IF EXISTS → 안전하게 재생성)
-- ============================================================

-- users
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_select_leader" ON public.users;
CREATE POLICY "users_select_leader" ON public.users
  FOR SELECT USING (public.is_leader());

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_leader" ON public.users;
CREATE POLICY "users_update_leader" ON public.users
  FOR UPDATE USING (public.is_leader());

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- bible_studies
DROP POLICY IF EXISTS "bible_studies_select_active" ON public.bible_studies;
CREATE POLICY "bible_studies_select_active" ON public.bible_studies
  FOR SELECT USING (published = true AND public.is_active());

DROP POLICY IF EXISTS "bible_studies_all_leader" ON public.bible_studies;
CREATE POLICY "bible_studies_all_leader" ON public.bible_studies
  FOR ALL USING (public.is_leader());

-- study_answers
DROP POLICY IF EXISTS "study_answers_own" ON public.study_answers;
CREATE POLICY "study_answers_own" ON public.study_answers
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "study_answers_leader_select" ON public.study_answers;
CREATE POLICY "study_answers_leader_select" ON public.study_answers
  FOR SELECT USING (public.is_leader());

-- prayer_requests
DROP POLICY IF EXISTS "prayer_requests_own" ON public.prayer_requests;
CREATE POLICY "prayer_requests_own" ON public.prayer_requests
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prayer_requests_leader" ON public.prayer_requests;
CREATE POLICY "prayer_requests_leader" ON public.prayer_requests
  FOR ALL USING (public.is_leader());

-- bible_reading_logs
DROP POLICY IF EXISTS "bible_reading_logs_own" ON public.bible_reading_logs;
CREATE POLICY "bible_reading_logs_own" ON public.bible_reading_logs
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bible_reading_logs_leader_select" ON public.bible_reading_logs;
CREATE POLICY "bible_reading_logs_leader_select" ON public.bible_reading_logs
  FOR SELECT USING (public.is_leader());

-- schedules
DROP POLICY IF EXISTS "schedules_select_active" ON public.schedules;
CREATE POLICY "schedules_select_active" ON public.schedules
  FOR SELECT USING (public.is_active());

DROP POLICY IF EXISTS "schedules_crud_leader" ON public.schedules;
CREATE POLICY "schedules_crud_leader" ON public.schedules
  FOR ALL USING (public.is_leader());

-- attendances
DROP POLICY IF EXISTS "attendances_own" ON public.attendances;
CREATE POLICY "attendances_own" ON public.attendances
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "attendances_leader" ON public.attendances;
CREATE POLICY "attendances_leader" ON public.attendances
  FOR ALL USING (public.is_leader());

-- daily_devotionals
DROP POLICY IF EXISTS "daily_devotionals_select_active" ON public.daily_devotionals;
CREATE POLICY "daily_devotionals_select_active" ON public.daily_devotionals
  FOR SELECT USING (public.is_active());

DROP POLICY IF EXISTS "daily_devotionals_crud_leader" ON public.daily_devotionals;
CREATE POLICY "daily_devotionals_crud_leader" ON public.daily_devotionals
  FOR ALL USING (public.is_leader());

-- weekly_reports
DROP POLICY IF EXISTS "weekly_reports_select_active" ON public.weekly_reports;
CREATE POLICY "weekly_reports_select_active" ON public.weekly_reports
  FOR SELECT USING (public.is_active());

DROP POLICY IF EXISTS "weekly_reports_crud_leader" ON public.weekly_reports;
CREATE POLICY "weekly_reports_crud_leader" ON public.weekly_reports
  FOR ALL USING (public.is_leader());

-- ============================================================
-- 002_dev_bypass 정책 제거 (있으면 삭제, 없으면 무시)
-- ============================================================
DROP POLICY IF EXISTS "dev_anon_users" ON public.users;
DROP POLICY IF EXISTS "dev_anon_bible_studies" ON public.bible_studies;
DROP POLICY IF EXISTS "dev_anon_study_answers" ON public.study_answers;
DROP POLICY IF EXISTS "dev_anon_prayer_requests" ON public.prayer_requests;
DROP POLICY IF EXISTS "dev_anon_bible_reading_logs" ON public.bible_reading_logs;
DROP POLICY IF EXISTS "dev_anon_schedules" ON public.schedules;
DROP POLICY IF EXISTS "dev_anon_attendances" ON public.attendances;
DROP POLICY IF EXISTS "dev_anon_daily_devotionals" ON public.daily_devotionals;
DROP POLICY IF EXISTS "dev_anon_weekly_reports" ON public.weekly_reports;

-- anon 과도한 권한 제거
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================================
-- 샘플 성경공부 데이터 (없으면 삽입)
-- ============================================================
INSERT INTO public.bible_studies (week_number, title, scripture, introduction, questions, study_date, published)
VALUES
  (10, '하나님의 사랑과 은혜', '요한복음 3:16-21',
   '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라.',
   '["요한복음 3:16에서 하나님의 사랑의 크기를 어떻게 느끼시나요?","독생자를 주셨다는 것은 어떤 의미인지 나눠봅시다.","믿는 자마다 영생을 얻는다는 약속이 여러분의 삶에 어떤 확신을 주나요?","하나님의 사랑을 경험한 구체적인 사례를 나눠주세요.","이번 주 실천할 수 있는 것은 무엇일까요?"]',
   '2026-03-08', true),
  (9, '믿음의 반석 위에', '마태복음 7:24-29',
   '예수님은 반석 위에 집을 짓는 자의 비유를 통해 말씀을 듣고 행하는 것의 중요성을 가르쳐 주셨습니다.',
   '["반석 위에 집을 짓는다는 것은 우리 신앙생활에서 어떤 의미일까요?","말씀을 듣기만 하고 행하지 않는 경우는 어떤 것이 있을까요?","시련이 왔을 때 흔들리지 않으려면 어떻게 해야 할까요?","최근 말씀을 실천한 경험이 있다면 나눠주세요."]',
   '2026-03-01', true)
ON CONFLICT DO NOTHING;
