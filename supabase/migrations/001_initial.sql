-- ============================================================
-- 벧엘교회 킨텍스장성남 구역 앱 초기 스키마
-- Supabase 대시보드 SQL Editor에서 전체 실행
-- ============================================================

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. users 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. bible_studies 테이블
-- ============================================================
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

CREATE TRIGGER bible_studies_updated_at
  BEFORE UPDATE ON public.bible_studies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 3. study_answers 테이블
-- ============================================================
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

CREATE TRIGGER study_answers_updated_at
  BEFORE UPDATE ON public.study_answers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. prayer_requests 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  response TEXT,
  answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER prayer_requests_updated_at
  BEFORE UPDATE ON public.prayer_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. bible_reading_logs 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bible_reading_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  chapters INTEGER NOT NULL CHECK (chapters > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER bible_reading_logs_updated_at
  BEFORE UPDATE ON public.bible_reading_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. schedules 테이블
-- ============================================================
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

CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 7. attendances 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attending', 'absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(schedule_id, user_id)
);

CREATE TRIGGER attendances_updated_at
  BEFORE UPDATE ON public.attendances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 8. daily_devotionals 테이블
-- ============================================================
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

CREATE TRIGGER daily_devotionals_updated_at
  BEFORE UPDATE ON public.daily_devotionals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 9. weekly_reports 테이블
-- ============================================================
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

CREATE TRIGGER weekly_reports_updated_at
  BEFORE UPDATE ON public.weekly_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 10. auth.users 가입 시 public.users 자동 생성 트리거
-- 특별 이메일(bethel803leader@gmail.com)은 leader + active로 등록
-- 그 외는 member + pending으로 등록
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_role TEXT;
  user_status TEXT;
BEGIN
  -- raw_user_meta_data에서 이름 추출
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  -- 특별 이메일이거나 첫 번째 사용자이면 leader
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
  VALUES (NEW.id, user_name, user_role, user_status);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 11. RLS (Row Level Security) 활성화
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
-- 12. RLS 정책
-- ============================================================

-- users: 본인 조회, 구역장은 전체 조회/수정
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_select_leader" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_update_leader" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- bible_studies: 활성 사용자는 published=true 조회, 구역장은 전체 CRUD
CREATE POLICY "bible_studies_select_active" ON public.bible_studies
  FOR SELECT USING (
    published = true AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "bible_studies_all_leader" ON public.bible_studies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

-- study_answers: 본인 것만 CRUD, 구역장은 전체 조회
CREATE POLICY "study_answers_own" ON public.study_answers
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "study_answers_leader_select" ON public.study_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

-- prayer_requests: 본인 것만 CRUD, 구역장은 전체 조회/수정
CREATE POLICY "prayer_requests_own" ON public.prayer_requests
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "prayer_requests_leader" ON public.prayer_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

-- bible_reading_logs: 본인 것만 CRUD, 구역장은 전체 조회
CREATE POLICY "bible_reading_logs_own" ON public.bible_reading_logs
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "bible_reading_logs_leader_select" ON public.bible_reading_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

-- schedules: 활성 사용자는 조회, 구역장은 전체 CRUD
CREATE POLICY "schedules_select_active" ON public.schedules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "schedules_crud_leader" ON public.schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

-- attendances: 본인 것만 CRUD, 구역장은 전체 조회/수정
CREATE POLICY "attendances_own" ON public.attendances
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "attendances_leader" ON public.attendances
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

-- daily_devotionals: 활성 사용자는 조회
CREATE POLICY "daily_devotionals_select_active" ON public.daily_devotionals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "daily_devotionals_crud_leader" ON public.daily_devotionals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

-- weekly_reports: 구역장만 CRUD, 활성 사용자는 조회
CREATE POLICY "weekly_reports_select_active" ON public.weekly_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "weekly_reports_crud_leader" ON public.weekly_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'leader')
  );

-- ============================================================
-- 13. 샘플 성경공부 데이터 삽입
-- ============================================================
INSERT INTO public.bible_studies (week_number, title, scripture, introduction, questions, study_date, published)
VALUES
  (10, '하나님의 사랑과 은혜', '요한복음 3:16-21',
   '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라. 이번 주 우리는 하나님의 무한한 사랑과 은혜에 대해 함께 나누겠습니다.',
   '["요한복음 3:16에서 세상을 이처럼 사랑하사라는 말씀에서 하나님의 사랑의 크기를 어떻게 느끼시나요?","독생자를 주셨다는 것은 어떤 의미인지 나눠봅시다.","믿는 자마다 영생을 얻는다는 약속이 여러분의 삶에 어떤 확신을 주나요?","하나님의 사랑을 경험한 구체적인 사례를 나눠주세요.","이 말씀을 통해 이번 주 실천할 수 있는 것은 무엇일까요?","주변에 하나님의 사랑을 전할 대상이 있다면 누구인가요?"]',
   '2026-03-08', true),
  (9, '믿음의 반석 위에', '마태복음 7:24-29',
   '예수님은 반석 위에 집을 짓는 자와 모래 위에 집을 짓는 자의 비유를 통해 말씀을 듣고 행하는 것의 중요성을 가르쳐 주셨습니다.',
   '["반석 위에 집을 짓는다는 것은 우리 신앙생활에서 어떤 의미일까요?","말씀을 듣기만 하고 행하지 않는 경우는 어떤 것이 있을까요?","비와 바람(시련)이 왔을 때 흔들리지 않으려면 어떻게 해야 할까요?","최근 말씀을 실천한 경험이 있다면 나눠주세요.","이번 주 말씀을 통해 결단할 수 있는 것은 무엇인가요?"]',
   '2026-03-01', true),
  (8, '성령의 열매', '갈라디아서 5:22-26',
   '성령의 열매는 사랑, 희락, 화평, 오래 참음, 자비, 양선, 충성, 온유, 절제입니다. 이 열매들이 우리 삶에서 어떻게 맺혀가는지 함께 살펴봅시다.',
   '["성령의 9가지 열매 중 가장 필요하다고 느끼는 것은 무엇인가요?","사랑의 열매가 우리 구역 안에서 어떻게 나타날 수 있을까요?","오래 참음과 절제를 실천하기 어려운 상황은 어떤 것인가요?","성령의 열매를 맺기 위해 우리가 해야 할 역할은 무엇일까요?","이번 주 특별히 기도하며 키워가고 싶은 열매는 무엇인가요?"]',
   '2026-02-22', true)
ON CONFLICT DO NOTHING;
