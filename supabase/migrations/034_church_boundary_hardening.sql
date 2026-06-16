-- ============================================================
-- 034. 교회 경계(테넌트 격리) 강화
-- ============================================================
-- 배경: scripts/test_tenant_isolation.mjs 전수 검증에서 교차 교회 누수 발견.
--   021 SaaS 전환 시 일부 정책/함수가 교회 스코프로 갱신되지 않아,
--   전역 is_master()/is_leader() 또는 가드 없는 SECURITY DEFINER로 누수.
--
-- 수정 대상:
--   1. churches: 모든 active 교회 노출 정책 → 자기 교회만
--   2. notification_preferences / push_subscriptions / push_deliveries:
--      전역 is_master() → 교회 스코프 마스터
--   3. study_sources: church_id 추가 + 교회 스코프 정책
--   4. 구역 파라미터 SECURITY DEFINER 함수 4종: 호출자 교회 소속 가드
--   5. create_bible_study_from_source: 원본 교회 일치 가드
--
-- 벧엘 교회 id: 00000000-0000-4100-a000-000000000001

-- ============================================================
-- 1. churches: 자기 교회만 조회 (전역 active 노출 제거)
-- ============================================================
-- 앱은 churches를 직접 읽지 않고 get_my_church_info()(SECURITY DEFINER)로 접근하므로
-- 자기 교회만 남겨도 기능 영향 없음.
DROP POLICY IF EXISTS "churches_select_active" ON public.churches;

DROP POLICY IF EXISTS "churches_self_read" ON public.churches;
CREATE POLICY "churches_self_read" ON public.churches
  FOR SELECT USING (id = public.get_my_church_id());

-- ============================================================
-- 2. 알림/푸시 테이블: 전역 is_master() 제거 → 본인 전용
-- ============================================================
-- 이 세 테이블은 개인 데이터다. 앱은 본인 것만 읽고(Profile/api.ts),
-- 발송은 push-dispatch(service_role, RLS 우회)가 처리하므로
-- 마스터/리더가 타인의 알림설정·구독을 읽을 기능이 없다.
-- → 전역 is_master() 허용을 제거하고 소유자 전용으로 봉합(교회 경계 누수 차단).

-- 드리프트 정리: repo에 없으나 staging/prod에 수동 추가된 전역 마스터 열람 정책 제거
-- (RLS는 OR 평가 → 이 정책 한 줄이 교회 경계를 무력화함)
DROP POLICY IF EXISTS "notification_preferences_select_master" ON public.notification_preferences;
DROP POLICY IF EXISTS "notification_preferences_update_master" ON public.notification_preferences;
DROP POLICY IF EXISTS "push_subscriptions_select_master" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update_master" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_deliveries_update_master" ON public.push_deliveries;

-- notification_preferences
DROP POLICY IF EXISTS "notification_preferences_select_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_select_own" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_preferences_update_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_update_own" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- push_subscriptions
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- push_deliveries (본인 발송 이력만; 관리는 service_role)
DROP POLICY IF EXISTS "push_deliveries_select_master" ON public.push_deliveries;
DROP POLICY IF EXISTS "push_deliveries_select_own" ON public.push_deliveries;
CREATE POLICY "push_deliveries_select_own" ON public.push_deliveries
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 3. study_sources: church_id 추가 + 교회 스코프
-- ============================================================
-- 주보 파싱은 벧엘 전용 모듈이나, 다교회 환경에서 누수/충돌 방지를 위해 교회 귀속.
ALTER TABLE public.study_sources
  ADD COLUMN IF NOT EXISTS church_id UUID
    REFERENCES public.churches(id) ON DELETE CASCADE
    DEFAULT '00000000-0000-4100-a000-000000000001';

UPDATE public.study_sources
  SET church_id = '00000000-0000-4100-a000-000000000001'
  WHERE church_id IS NULL;

-- study_date 전역 UNIQUE → (church_id, study_date) UNIQUE
ALTER TABLE public.study_sources DROP CONSTRAINT IF EXISTS study_sources_study_date_key;
ALTER TABLE public.study_sources DROP CONSTRAINT IF EXISTS study_sources_church_date_key;
ALTER TABLE public.study_sources
  ADD CONSTRAINT study_sources_church_date_key UNIQUE (church_id, study_date);

DROP POLICY IF EXISTS "study_sources_select_leader" ON public.study_sources;
CREATE POLICY "study_sources_select_leader" ON public.study_sources
  FOR SELECT USING (
    public.is_church_master(church_id) OR public.is_church_leader(church_id)
  );

DROP POLICY IF EXISTS "study_sources_insert_leader" ON public.study_sources;
CREATE POLICY "study_sources_insert_leader" ON public.study_sources
  FOR INSERT WITH CHECK (
    public.is_church_master(church_id) OR public.is_church_leader(church_id)
  );

DROP POLICY IF EXISTS "study_sources_update_master" ON public.study_sources;
CREATE POLICY "study_sources_update_master" ON public.study_sources
  FOR UPDATE USING (public.is_church_master(church_id))
  WITH CHECK (public.is_church_master(church_id));

DROP POLICY IF EXISTS "study_sources_delete_master" ON public.study_sources;
CREATE POLICY "study_sources_delete_master" ON public.study_sources
  FOR DELETE USING (public.is_church_master(church_id));

-- ============================================================
-- 4. 구역 파라미터 SECURITY DEFINER 함수: 호출자 교회 소속 가드
-- ============================================================
-- users.church_id는 sync_user_church_from_district 트리거로 동기화됨.
-- 타 교회 구역 id를 넘기면 u.church_id != get_my_church_id() → 0행.

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
    AND u.church_id = public.get_my_church_id()   -- 교회 경계 가드
  ORDER BY is_completed DESC, u.name;
$$;

CREATE OR REPLACE FUNCTION public.get_bible_reading_summaries(p_district_id UUID)
RETURNS TABLE(user_id UUID, user_name TEXT, total_chapters BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    brl.user_id,
    u.name            AS user_name,
    SUM(brl.chapters)::BIGINT AS total_chapters
  FROM public.bible_reading_logs brl
  JOIN public.users u ON u.id = brl.user_id
  WHERE u.district_id = p_district_id
    AND u.church_id = public.get_my_church_id()   -- 교회 경계 가드
  GROUP BY brl.user_id, u.name
  ORDER BY total_chapters DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_bible_reading_summaries_by_range(
  p_district_id UUID,
  p_from        DATE,
  p_to          DATE
)
RETURNS TABLE(user_id UUID, user_name TEXT, total_chapters BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    brl.user_id,
    u.name            AS user_name,
    SUM(brl.chapters)::BIGINT AS total_chapters
  FROM public.bible_reading_logs brl
  JOIN public.users u ON u.id = brl.user_id
  WHERE u.district_id = p_district_id
    AND u.church_id = public.get_my_church_id()   -- 교회 경계 가드
    AND brl.log_date >= p_from
    AND brl.log_date <= p_to
  GROUP BY brl.user_id, u.name
  ORDER BY total_chapters DESC;
$$;

-- compute_weekly_report(2-arg): 명시 district가 호출자 교회 소속인지 검증.
-- pg_cron(auth.uid()=null) 경로는 가드 통과(시스템 잡).
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

  -- 교회 경계 가드: 명시 호출(인증됨)일 때 대상 구역이 호출자 교회 소속인지 검증
  IF auth.uid() IS NOT NULL
     AND (SELECT church_id FROM public.districts WHERE id = v_district_id)
         IS DISTINCT FROM public.get_my_church_id() THEN
    RAISE EXCEPTION 'Unauthorized: cross-church district';
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
-- 5. create_bible_study_from_source: 원본 교회 일치 가드
-- ============================================================

-- ============================================================
-- 6. notifications: 교회 스코프 SELECT 정책 교체
-- ============================================================
-- 008에서 만든 "active users can read notifications" 정책은 전 교회 알림을 노출.
-- staging orphan 드리프트(notifications_select_active 등)도 전역 is_master() 사용.
-- district_id → districts.church_id 경유로 교회 경계 강제.
--
-- service 범위 알림(scope_type='service', district_id=NULL): 시스템 공지 성격이므로
-- 교회 구분 없이 모든 active 유저에게 표시 (fetch-devotional 등 service_role이 삽입).
-- district 범위 알림: 내 교회 구역 알림만 + 마스터/해당 구역원만 열람.

DROP POLICY IF EXISTS "active users can read notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_active" ON public.notifications;
CREATE POLICY "notifications_select_active" ON public.notifications
  FOR SELECT USING (
    public.is_active()
    AND (
      scope_type = 'service'
      OR (
        scope_type = 'district'
        AND EXISTS (
          SELECT 1 FROM public.districts d
          WHERE d.id = notifications.district_id
            AND d.church_id = public.get_my_church_id()
            AND (
              public.is_church_master(d.church_id)
              OR d.id = public.get_my_district_id()
            )
        )
      )
    )
  );

-- orphan 드리프트 삭제 정책 제거 (021의 notifications_delete_leader가 이미 church-scoped)
DROP POLICY IF EXISTS "notifications_delete_district" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_service" ON public.notifications;
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

  -- 대상 구역이 호출자 교회 소속인지 (타 교회 구역에 생성 차단)
  IF auth.uid() IS NOT NULL
     AND (SELECT church_id FROM public.districts WHERE id = v_district_id)
         IS DISTINCT FROM public.get_my_church_id() THEN
    RAISE EXCEPTION 'Unauthorized: cross-church district';
  END IF;

  SELECT * INTO v_source
  FROM public.study_sources
  WHERE id = p_source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'study source not found';
  END IF;

  -- 원본이 호출자 교회 소유인지 (타 교회 원본 복제 차단)
  IF auth.uid() IS NOT NULL
     AND v_source.church_id IS DISTINCT FROM public.get_my_church_id() THEN
    RAISE EXCEPTION 'Unauthorized: cross-church source';
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
