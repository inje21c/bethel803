-- ============================================================
-- 012: 멀티구역 확장 마이그레이션
-- districts 테이블 생성, district_id FK 추가, 역할 체계 변경
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

-- ============================================================
-- 1. districts 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS districts_updated_at ON public.districts;
CREATE TRIGGER districts_updated_at
  BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. 기본 구역 시드
-- ============================================================
INSERT INTO public.districts (id, name, description)
VALUES ('00000000-0000-4000-a000-000000000001', '킨텍스장성남', '벧엘교회 킨텍스장성남 구역')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. district_id 컬럼 추가 (ADD → UPDATE → NOT NULL)
-- ============================================================

-- users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id);
UPDATE public.users SET district_id = '00000000-0000-4000-a000-000000000001' WHERE district_id IS NULL;
ALTER TABLE public.users ALTER COLUMN district_id SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN district_id SET DEFAULT '00000000-0000-4000-a000-000000000001';

-- bible_studies
ALTER TABLE public.bible_studies ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id);
UPDATE public.bible_studies SET district_id = '00000000-0000-4000-a000-000000000001' WHERE district_id IS NULL;
ALTER TABLE public.bible_studies ALTER COLUMN district_id SET NOT NULL;
ALTER TABLE public.bible_studies ALTER COLUMN district_id SET DEFAULT '00000000-0000-4000-a000-000000000001';

-- schedules
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id);
UPDATE public.schedules SET district_id = '00000000-0000-4000-a000-000000000001' WHERE district_id IS NULL;
ALTER TABLE public.schedules ALTER COLUMN district_id SET NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN district_id SET DEFAULT '00000000-0000-4000-a000-000000000001';

-- weekly_reports
ALTER TABLE public.weekly_reports ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id);
UPDATE public.weekly_reports SET district_id = '00000000-0000-4000-a000-000000000001' WHERE district_id IS NULL;
ALTER TABLE public.weekly_reports ALTER COLUMN district_id SET NOT NULL;
ALTER TABLE public.weekly_reports ALTER COLUMN district_id SET DEFAULT '00000000-0000-4000-a000-000000000001';

-- notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id);
UPDATE public.notifications SET district_id = '00000000-0000-4000-a000-000000000001' WHERE district_id IS NULL;
ALTER TABLE public.notifications ALTER COLUMN district_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN district_id SET DEFAULT '00000000-0000-4000-a000-000000000001';

-- ============================================================
-- 4. 역할 체계 변경: leader/member → master/leader/member
-- ============================================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('master', 'leader', 'member'));

-- cmhyun@gmail.com → master 승격
UPDATE public.users SET role = 'master'
WHERE id = (SELECT id FROM auth.users WHERE email = 'cmhyun@gmail.com');

-- ============================================================
-- 5. weekly_reports UNIQUE 제약 변경: week_start → (week_start, district_id)
-- ============================================================
ALTER TABLE public.weekly_reports DROP CONSTRAINT IF EXISTS weekly_reports_week_start_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_reports_week_district_key'
  ) THEN
    ALTER TABLE public.weekly_reports ADD CONSTRAINT weekly_reports_week_district_key
      UNIQUE (week_start, district_id);
  END IF;
END $$;

-- ============================================================
-- 6. RLS 헬퍼 함수 업데이트
-- ============================================================

-- is_leader(): master도 포함
CREATE OR REPLACE FUNCTION public.is_leader()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('master', 'leader')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 신규: is_master()
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 신규: get_my_district_id()
CREATE OR REPLACE FUNCTION public.get_my_district_id()
RETURNS UUID AS $$
  SELECT district_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 7. districts 테이블 RLS
-- ============================================================
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

-- 활성 사용자: active 구역 SELECT (회원가입 시 구역 선택용)
DROP POLICY IF EXISTS "districts_select_active" ON public.districts;
CREATE POLICY "districts_select_active" ON public.districts
  FOR SELECT USING (is_active = true);

-- 마스터: 전체 CRUD
DROP POLICY IF EXISTS "districts_all_master" ON public.districts;
CREATE POLICY "districts_all_master" ON public.districts
  FOR ALL USING (public.is_master());

-- anon: active 구역 SELECT (회원가입 폼용)
DROP POLICY IF EXISTS "districts_select_anon" ON public.districts;
CREATE POLICY "districts_select_anon" ON public.districts
  FOR SELECT TO anon USING (is_active = true);

GRANT SELECT ON public.districts TO anon;

-- ============================================================
-- 8. RLS 정책 업데이트 (구역 스코프 추가)
-- ============================================================

-- === users ===
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_select_leader" ON public.users;
CREATE POLICY "users_select_leader" ON public.users
  FOR SELECT USING (
    public.is_master() OR (
      public.is_leader() AND district_id = public.get_my_district_id()
    )
  );

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_leader" ON public.users;
CREATE POLICY "users_update_leader" ON public.users
  FOR UPDATE USING (
    public.is_master() OR (
      public.is_leader() AND district_id = public.get_my_district_id()
    )
  );

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 마스터: 사용자 삭제 (거부 기능)
DROP POLICY IF EXISTS "users_delete_leader" ON public.users;
CREATE POLICY "users_delete_leader" ON public.users
  FOR DELETE USING (
    public.is_master() OR (
      public.is_leader() AND district_id = public.get_my_district_id()
    )
  );

-- === bible_studies ===
DROP POLICY IF EXISTS "bible_studies_select_active" ON public.bible_studies;
CREATE POLICY "bible_studies_select_active" ON public.bible_studies
  FOR SELECT USING (
    published = true AND public.is_active()
    AND district_id = public.get_my_district_id()
  );

DROP POLICY IF EXISTS "bible_studies_all_leader" ON public.bible_studies;
CREATE POLICY "bible_studies_all_leader" ON public.bible_studies
  FOR ALL USING (
    public.is_master() OR (
      public.is_leader() AND district_id = public.get_my_district_id()
    )
  );

-- === study_answers ===
DROP POLICY IF EXISTS "study_answers_own" ON public.study_answers;
CREATE POLICY "study_answers_own" ON public.study_answers
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "study_answers_leader_select" ON public.study_answers;
CREATE POLICY "study_answers_leader_select" ON public.study_answers
  FOR SELECT USING (
    public.is_master() OR (
      public.is_leader() AND EXISTS (
        SELECT 1 FROM public.bible_studies bs
        WHERE bs.id = study_answers.study_id
          AND bs.district_id = public.get_my_district_id()
      )
    )
  );

-- === prayer_requests ===
DROP POLICY IF EXISTS "prayer_requests_own" ON public.prayer_requests;
CREATE POLICY "prayer_requests_own" ON public.prayer_requests
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prayer_requests_leader_shared" ON public.prayer_requests;
CREATE POLICY "prayer_requests_leader_shared" ON public.prayer_requests
  FOR SELECT USING (
    shared_with_leader = true AND (
      public.is_master() OR (
        public.is_leader() AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = prayer_requests.user_id
            AND u.district_id = public.get_my_district_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "prayer_requests_group" ON public.prayer_requests;
CREATE POLICY "prayer_requests_group" ON public.prayer_requests
  FOR SELECT USING (
    shared_with_group = true AND public.is_active()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = prayer_requests.user_id
        AND u.district_id = public.get_my_district_id()
    )
  );

DROP POLICY IF EXISTS "prayer_requests_leader_update" ON public.prayer_requests;
CREATE POLICY "prayer_requests_leader_update" ON public.prayer_requests
  FOR UPDATE USING (
    public.is_master() OR (
      public.is_leader() AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = prayer_requests.user_id
          AND u.district_id = public.get_my_district_id()
      )
    )
  );

-- === bible_reading_logs ===
DROP POLICY IF EXISTS "bible_reading_logs_own" ON public.bible_reading_logs;
CREATE POLICY "bible_reading_logs_own" ON public.bible_reading_logs
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bible_reading_logs_leader_select" ON public.bible_reading_logs;
CREATE POLICY "bible_reading_logs_leader_select" ON public.bible_reading_logs
  FOR SELECT USING (
    public.is_master() OR (
      public.is_leader() AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = bible_reading_logs.user_id
          AND u.district_id = public.get_my_district_id()
      )
    )
  );

-- === schedules ===
DROP POLICY IF EXISTS "schedules_select_active" ON public.schedules;
CREATE POLICY "schedules_select_active" ON public.schedules
  FOR SELECT USING (
    public.is_active()
    AND district_id = public.get_my_district_id()
  );

DROP POLICY IF EXISTS "schedules_crud_leader" ON public.schedules;
CREATE POLICY "schedules_crud_leader" ON public.schedules
  FOR ALL USING (
    public.is_master() OR (
      public.is_leader() AND district_id = public.get_my_district_id()
    )
  );

-- === attendances ===
DROP POLICY IF EXISTS "attendances_own" ON public.attendances;
CREATE POLICY "attendances_own" ON public.attendances
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "attendances_leader" ON public.attendances;
CREATE POLICY "attendances_leader" ON public.attendances
  FOR ALL USING (
    public.is_master() OR (
      public.is_leader() AND EXISTS (
        SELECT 1 FROM public.schedules s
        WHERE s.id = attendances.schedule_id
          AND s.district_id = public.get_my_district_id()
      )
    )
  );

-- === daily_devotionals (교회 전체 공유 — 변경 없음) ===
-- 기존 정책 유지

-- === weekly_reports ===
DROP POLICY IF EXISTS "weekly_reports_select_active" ON public.weekly_reports;
CREATE POLICY "weekly_reports_select_active" ON public.weekly_reports
  FOR SELECT USING (
    public.is_active()
    AND district_id = public.get_my_district_id()
  );

DROP POLICY IF EXISTS "weekly_reports_crud_leader" ON public.weekly_reports;
CREATE POLICY "weekly_reports_crud_leader" ON public.weekly_reports
  FOR ALL USING (
    public.is_master() OR (
      public.is_leader() AND district_id = public.get_my_district_id()
    )
  );

-- === notifications ===
DROP POLICY IF EXISTS "active users can read notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_active" ON public.notifications;
CREATE POLICY "notifications_select_active" ON public.notifications
  FOR SELECT USING (
    public.is_active()
    AND district_id = public.get_my_district_id()
  );

DROP POLICY IF EXISTS "leader can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_leader" ON public.notifications;
CREATE POLICY "notifications_insert_leader" ON public.notifications
  FOR INSERT WITH CHECK (
    (public.is_master() OR public.is_leader()) AND public.is_active()
  );

DROP POLICY IF EXISTS "leader can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_leader" ON public.notifications;
CREATE POLICY "notifications_delete_leader" ON public.notifications
  FOR DELETE USING (
    public.is_master() OR (
      public.is_leader() AND district_id = public.get_my_district_id()
    )
  );

-- === prayer_responses ===
DROP POLICY IF EXISTS "prayer_responses_leader_shared" ON public.prayer_responses;
CREATE POLICY "prayer_responses_leader_shared" ON public.prayer_responses
  FOR SELECT USING (
    (public.is_master() OR public.is_leader()) AND EXISTS (
      SELECT 1 FROM public.prayer_requests pr
      JOIN public.users u ON u.id = pr.user_id
      WHERE pr.id = prayer_responses.prayer_request_id
        AND pr.shared_with_leader = true
        AND (public.is_master() OR u.district_id = public.get_my_district_id())
    )
  );

DROP POLICY IF EXISTS "prayer_responses_group" ON public.prayer_responses;
CREATE POLICY "prayer_responses_group" ON public.prayer_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.prayer_requests pr
      JOIN public.users u ON u.id = pr.user_id
      WHERE pr.id = prayer_responses.prayer_request_id
        AND pr.shared_with_group = true
        AND u.district_id = public.get_my_district_id()
    ) AND public.is_active()
  );

-- === prayer_intercessions ===
DROP POLICY IF EXISTS "prayer_intercessions_own" ON public.prayer_intercessions;
CREATE POLICY "prayer_intercessions_own" ON public.prayer_intercessions
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prayer_intercessions_group" ON public.prayer_intercessions;
CREATE POLICY "prayer_intercessions_group" ON public.prayer_intercessions
  FOR SELECT USING (
    public.is_active() AND EXISTS (
      SELECT 1 FROM public.prayer_requests pr
      JOIN public.users u ON u.id = pr.user_id
      WHERE pr.id = prayer_intercessions.prayer_request_id
        AND pr.shared_with_group = true
        AND u.district_id = public.get_my_district_id()
    )
  );

-- ============================================================
-- 8-1. role 변경은 master만 가능 (트리거)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_role_change_master_only()
RETURNS TRIGGER AS $$
BEGIN
  -- role 값이 변경된 경우에만 체크
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT public.is_master() THEN
      RAISE EXCEPTION 'Only master can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_role_change ON public.users;
CREATE TRIGGER enforce_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_change_master_only();

-- ============================================================
-- 9. handle_new_user() 트리거 업데이트
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_role TEXT;
  user_status TEXT;
  user_district_id UUID;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  -- district_id: meta에서 추출, 없으면 첫 번째 활성 구역
  user_district_id := (NEW.raw_user_meta_data->>'district_id')::UUID;
  IF user_district_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.districts WHERE id = user_district_id AND is_active = true
  ) THEN
    SELECT id INTO user_district_id FROM public.districts WHERE is_active = true ORDER BY created_at LIMIT 1;
  END IF;

  -- 역할 결정
  IF NEW.email = 'cmhyun@gmail.com' THEN
    user_role := 'master';
    user_status := 'active';
  ELSIF NEW.email = 'bethel803leader@gmail.com' THEN
    user_role := 'leader';
    user_status := 'active';
  ELSIF (SELECT COUNT(*) FROM public.users) = 0 THEN
    user_role := 'master';
    user_status := 'active';
  ELSE
    user_role := 'member';
    user_status := 'pending';
  END IF;

  INSERT INTO public.users (id, name, role, status, district_id)
  VALUES (NEW.id, user_name, user_role, user_status, user_district_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. compute_weekly_report() 업데이트 (district_id 파라미터)
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_weekly_report(p_week_start DATE, p_district_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_district_id UUID;
  v_week_end DATE;
  v_week_number INTEGER;
  v_attendance_count INTEGER;
  v_attendance_names TEXT[];
  v_bible_chapters INTEGER;
  v_study_completion INTEGER;
  v_report_text TEXT;
  v_district_name TEXT;
BEGIN
  -- 구역장 권한 확인 (pg_cron 호출 시 auth.uid()=null이면 통과)
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('master', 'leader')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: leader only';
  END IF;

  -- district_id 결정
  IF p_district_id IS NOT NULL THEN
    v_district_id := p_district_id;
  ELSIF auth.uid() IS NOT NULL THEN
    SELECT district_id INTO v_district_id FROM public.users WHERE id = auth.uid();
  ELSE
    -- pg_cron: 첫 번째 활성 구역 (루프 호출 시 각각 지정)
    SELECT id INTO v_district_id FROM public.districts WHERE is_active = true ORDER BY created_at LIMIT 1;
  END IF;

  SELECT name INTO v_district_name FROM public.districts WHERE id = v_district_id;

  v_week_end := p_week_start + INTERVAL '6 days';
  v_week_number := EXTRACT(WEEK FROM p_week_start);

  -- 출석 집계 (해당 구역)
  SELECT
    COUNT(a.user_id)::INTEGER,
    ARRAY_AGG(u.name ORDER BY u.name)
  INTO v_attendance_count, v_attendance_names
  FROM public.attendances a
  JOIN public.schedules s ON a.schedule_id = s.id
  JOIN public.users u ON a.user_id = u.id
  WHERE s.schedule_date BETWEEN p_week_start AND v_week_end
    AND s.attendance_check = true
    AND a.status = 'attending'
    AND s.district_id = v_district_id
    AND u.district_id = v_district_id;

  -- 성경읽기 합계 (해당 구역)
  SELECT COALESCE(SUM(brl.chapters), 0)::INTEGER
  INTO v_bible_chapters
  FROM public.bible_reading_logs brl
  JOIN public.users u ON brl.user_id = u.id
  WHERE brl.log_date BETWEEN p_week_start AND v_week_end
    AND u.district_id = v_district_id;

  -- 성경공부 완료 수 (해당 구역)
  SELECT COUNT(sa.id)::INTEGER
  INTO v_study_completion
  FROM public.study_answers sa
  JOIN public.bible_studies bs ON sa.study_id = bs.id
  WHERE bs.study_date BETWEEN p_week_start AND v_week_end
    AND sa.completed = true
    AND bs.district_id = v_district_id;

  -- 보고문자 텍스트
  v_report_text := format(
    '[%s주차 %s 구역 보고]' || E'\n' ||
    '출석: %s명 (%s)' || E'\n' ||
    '성경읽기: %s장' || E'\n' ||
    '성경공부 완료: %s명',
    v_week_number,
    COALESCE(v_district_name, ''),
    COALESCE(v_attendance_count, 0),
    COALESCE(ARRAY_TO_STRING(v_attendance_names, ', '), '없음'),
    COALESCE(v_bible_chapters, 0),
    COALESCE(v_study_completion, 0)
  );

  -- weekly_reports upsert (district_id 포함)
  INSERT INTO public.weekly_reports (
    week_start, week_end, week_number,
    attendance_count, attendance_names,
    bible_chapters_total, study_completion_count,
    report_text, is_locked, district_id
  ) VALUES (
    p_week_start, v_week_end, v_week_number,
    COALESCE(v_attendance_count, 0),
    COALESCE(v_attendance_names, ARRAY[]::TEXT[]),
    COALESCE(v_bible_chapters, 0),
    COALESCE(v_study_completion, 0),
    v_report_text,
    true,
    v_district_id
  )
  ON CONFLICT (week_start, district_id) DO UPDATE SET
    week_end          = EXCLUDED.week_end,
    week_number       = EXCLUDED.week_number,
    attendance_count  = EXCLUDED.attendance_count,
    attendance_names  = EXCLUDED.attendance_names,
    bible_chapters_total     = EXCLUDED.bible_chapters_total,
    study_completion_count   = EXCLUDED.study_completion_count,
    report_text       = EXCLUDED.report_text,
    is_locked         = true,
    updated_at        = NOW();

  RETURN json_build_object(
    'week_start',             p_week_start,
    'week_end',               v_week_end,
    'week_number',            v_week_number,
    'attendance_count',       COALESCE(v_attendance_count, 0),
    'attendance_names',       COALESCE(v_attendance_names, ARRAY[]::TEXT[]),
    'bible_chapters_total',   COALESCE(v_bible_chapters, 0),
    'study_completion_count', COALESCE(v_study_completion, 0),
    'report_text',            v_report_text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- pg_cron 업데이트 (모든 활성 구역에 대해 루프 실행)
-- Supabase 대시보드에서 기존 cron 삭제 후 아래 실행
-- ============================================================
-- SELECT cron.unschedule('weekly-close');
-- SELECT cron.schedule(
--   'weekly-close-all-districts',
--   '20 2 * * 0',
--   $$
--   DO $$
--   DECLARE
--     d RECORD;
--     ws DATE;
--   BEGIN
--     ws := DATE_TRUNC('week', (NOW() AT TIME ZONE 'Asia/Seoul')::DATE)::DATE;
--     FOR d IN SELECT id FROM public.districts WHERE is_active = true LOOP
--       PERFORM public.compute_weekly_report(ws, d.id);
--     END LOOP;
--   END;
--   $$
--   $$
-- );
