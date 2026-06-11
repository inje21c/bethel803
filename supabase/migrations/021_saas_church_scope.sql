-- ============================================================
-- 021: SaaS 전환 2단계 - church scope 기반
-- - churches 테이블 추가
-- - 기존 벧엘 데이터는 기본 교회 1곳에 귀속
-- - districts/users에 church_id 추가
-- - master 권한이 교회 경계를 넘지 않도록 핵심 RLS 보강
--
-- 주의:
-- - 이 마이그레이션은 결제/플랜 제한을 구현하지 않는다.
-- - 온보딩 UI와 교회 선택 가입 흐름은 후속 단계에서 구현한다.
-- ============================================================

-- ============================================================
-- 1. churches 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'legacy',
  billing_status TEXT NOT NULL DEFAULT 'manual',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.churches
  DROP CONSTRAINT IF EXISTS churches_status_check;

ALTER TABLE public.churches
  ADD CONSTRAINT churches_status_check
  CHECK (status IN ('active', 'trialing', 'past_due', 'suspended', 'archived'));

ALTER TABLE public.churches
  DROP CONSTRAINT IF EXISTS churches_plan_check;

ALTER TABLE public.churches
  ADD CONSTRAINT churches_plan_check
  CHECK (plan IN ('legacy', 'free', 'starter', 'standard', 'premium'));

ALTER TABLE public.churches
  DROP CONSTRAINT IF EXISTS churches_billing_status_check;

ALTER TABLE public.churches
  ADD CONSTRAINT churches_billing_status_check
  CHECK (billing_status IN ('manual', 'trialing', 'active', 'past_due', 'canceled'));

DROP TRIGGER IF EXISTS churches_updated_at ON public.churches;
CREATE TRIGGER churches_updated_at
  BEFORE UPDATE ON public.churches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.churches (
  id,
  name,
  slug,
  status,
  plan,
  billing_status
) VALUES (
  '00000000-0000-4100-a000-000000000001',
  '벧엘교회',
  'bethel',
  'active',
  'legacy',
  'manual'
)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS churches_status_idx
  ON public.churches (status);

-- ============================================================
-- 2. districts/users에 church_id 추가
-- ============================================================

ALTER TABLE public.districts
  ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE RESTRICT;

UPDATE public.districts
SET church_id = '00000000-0000-4100-a000-000000000001'
WHERE church_id IS NULL;

ALTER TABLE public.districts
  ALTER COLUMN church_id SET NOT NULL;

ALTER TABLE public.districts
  ALTER COLUMN church_id SET DEFAULT '00000000-0000-4100-a000-000000000001';

-- 기존 전역 구역명 UNIQUE는 SaaS에서 교회별 구역명 UNIQUE로 변경한다.
ALTER TABLE public.districts
  DROP CONSTRAINT IF EXISTS districts_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS districts_church_name_unique
  ON public.districts (church_id, name);

CREATE INDEX IF NOT EXISTS districts_church_active_idx
  ON public.districts (church_id, is_active);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE RESTRICT;

UPDATE public.users u
SET church_id = d.church_id
FROM public.districts d
WHERE u.district_id = d.id
  AND u.church_id IS NULL;

UPDATE public.users
SET church_id = '00000000-0000-4100-a000-000000000001'
WHERE church_id IS NULL;

ALTER TABLE public.users
  ALTER COLUMN church_id SET NOT NULL;

ALTER TABLE public.users
  ALTER COLUMN church_id SET DEFAULT '00000000-0000-4100-a000-000000000001';

CREATE INDEX IF NOT EXISTS users_church_status_idx
  ON public.users (church_id, status);

CREATE INDEX IF NOT EXISTS users_church_role_idx
  ON public.users (church_id, role);

-- ============================================================
-- 3. church helper 함수
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_church_id()
RETURNS UUID AS $$
  SELECT church_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_same_church(p_church_id UUID)
RETURNS BOOLEAN AS $$
  SELECT p_church_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND church_id = p_church_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_church_master(p_church_id UUID)
RETURNS BOOLEAN AS $$
  SELECT p_church_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'master'
        AND status = 'active'
        AND church_id = p_church_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_church_leader(p_church_id UUID)
RETURNS BOOLEAN AS $$
  SELECT p_church_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('master', 'leader')
        AND status = 'active'
        AND church_id = p_church_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 4. church_id 정합성 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_user_church_from_district()
RETURNS TRIGGER AS $$
DECLARE
  v_church_id UUID;
BEGIN
  SELECT church_id INTO v_church_id
  FROM public.districts
  WHERE id = NEW.district_id;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'Invalid district_id: district has no church';
  END IF;

  NEW.church_id := v_church_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_user_church ON public.users;
CREATE TRIGGER sync_user_church
  BEFORE INSERT OR UPDATE OF district_id, church_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_church_from_district();

CREATE OR REPLACE FUNCTION public.prevent_district_church_change_with_users()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.church_id IS DISTINCT FROM NEW.church_id
    AND EXISTS (SELECT 1 FROM public.users WHERE district_id = OLD.id)
  THEN
    RAISE EXCEPTION 'Cannot move district to another church while users exist';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_district_church_change ON public.districts;
CREATE TRIGGER prevent_district_church_change
  BEFORE UPDATE OF church_id ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_district_church_change_with_users();

CREATE OR REPLACE FUNCTION public.enforce_user_scope_change_master_only()
RETURNS TRIGGER AS $$
DECLARE
  v_next_church_id UUID;
BEGIN
  IF OLD.district_id IS DISTINCT FROM NEW.district_id
    OR OLD.church_id IS DISTINCT FROM NEW.church_id
  THEN
    IF NOT public.is_church_master(OLD.church_id) THEN
      RAISE EXCEPTION 'Only church master can move users between districts';
    END IF;

    SELECT church_id INTO v_next_church_id
    FROM public.districts
    WHERE id = NEW.district_id;

    IF v_next_church_id IS DISTINCT FROM OLD.church_id THEN
      RAISE EXCEPTION 'Cannot move user to another church';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_user_scope_change ON public.users;
CREATE TRIGGER enforce_user_scope_change
  BEFORE UPDATE OF district_id, church_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_scope_change_master_only();

-- ============================================================
-- 5. churches / districts / users RLS 보강
-- ============================================================

ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "churches_select_active" ON public.churches;
CREATE POLICY "churches_select_active" ON public.churches
  FOR SELECT USING (status IN ('active', 'trialing'));

DROP POLICY IF EXISTS "churches_update_own_master" ON public.churches;
CREATE POLICY "churches_update_own_master" ON public.churches
  FOR UPDATE USING (public.is_church_master(id))
  WITH CHECK (public.is_church_master(id));

DROP POLICY IF EXISTS "districts_select_active" ON public.districts;
CREATE POLICY "districts_select_active" ON public.districts
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.id = districts.church_id
        AND c.status IN ('active', 'trialing')
    )
  );

DROP POLICY IF EXISTS "districts_all_master" ON public.districts;
CREATE POLICY "districts_all_master" ON public.districts
  FOR ALL USING (public.is_church_master(church_id))
  WITH CHECK (public.is_church_master(church_id));

DROP POLICY IF EXISTS "districts_select_anon" ON public.districts;
CREATE POLICY "districts_select_anon" ON public.districts
  FOR SELECT TO anon USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.id = districts.church_id
        AND c.status IN ('active', 'trialing')
    )
  );

DROP POLICY IF EXISTS "users_select_leader" ON public.users;
CREATE POLICY "users_select_leader" ON public.users
  FOR SELECT USING (
    public.is_church_master(church_id) OR (
      public.is_church_leader(church_id)
      AND district_id = public.get_my_district_id()
    )
  );

DROP POLICY IF EXISTS "users_update_leader" ON public.users;
CREATE POLICY "users_update_leader" ON public.users
  FOR UPDATE USING (
    public.is_church_master(church_id) OR (
      public.is_church_leader(church_id)
      AND district_id = public.get_my_district_id()
    )
  )
  WITH CHECK (
    public.is_church_master(church_id) OR (
      public.is_church_leader(church_id)
      AND district_id = public.get_my_district_id()
    )
  );

DROP POLICY IF EXISTS "users_delete_leader" ON public.users;
CREATE POLICY "users_delete_leader" ON public.users
  FOR DELETE USING (
    public.is_church_master(church_id) OR (
      public.is_church_leader(church_id)
      AND district_id = public.get_my_district_id()
    )
  );

-- role 변경은 같은 교회 master만 가능하게 축소한다.
CREATE OR REPLACE FUNCTION public.enforce_role_change_master_only()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT public.is_church_master(OLD.church_id) THEN
      RAISE EXCEPTION 'Only church master can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5-1. 주요 업무 테이블 RLS: master를 교회 범위로 축소
-- ============================================================

DROP POLICY IF EXISTS "bible_studies_all_leader" ON public.bible_studies;
CREATE POLICY "bible_studies_all_leader" ON public.bible_studies
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.districts d
      WHERE d.id = bible_studies.district_id
        AND (
          public.is_church_master(d.church_id)
          OR (
            public.is_church_leader(d.church_id)
            AND bible_studies.district_id = public.get_my_district_id()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.districts d
      WHERE d.id = bible_studies.district_id
        AND (
          public.is_church_master(d.church_id)
          OR (
            public.is_church_leader(d.church_id)
            AND bible_studies.district_id = public.get_my_district_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "study_answers_leader_select" ON public.study_answers;
CREATE POLICY "study_answers_leader_select" ON public.study_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.bible_studies bs
      JOIN public.districts d ON d.id = bs.district_id
      WHERE bs.id = study_answers.study_id
        AND (
          public.is_church_master(d.church_id)
          OR (
            public.is_church_leader(d.church_id)
            AND bs.district_id = public.get_my_district_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "prayer_requests_leader_shared" ON public.prayer_requests;
CREATE POLICY "prayer_requests_leader_shared" ON public.prayer_requests
  FOR SELECT USING (
    shared_with_leader = true
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = prayer_requests.user_id
        AND (
          public.is_church_master(u.church_id)
          OR (
            public.is_church_leader(u.church_id)
            AND u.district_id = public.get_my_district_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "prayer_requests_leader_update" ON public.prayer_requests;
CREATE POLICY "prayer_requests_leader_update" ON public.prayer_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = prayer_requests.user_id
        AND (
          public.is_church_master(u.church_id)
          OR (
            public.is_church_leader(u.church_id)
            AND u.district_id = public.get_my_district_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "bible_reading_logs_leader_select" ON public.bible_reading_logs;
CREATE POLICY "bible_reading_logs_leader_select" ON public.bible_reading_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = bible_reading_logs.user_id
        AND (
          public.is_church_master(u.church_id)
          OR (
            public.is_church_leader(u.church_id)
            AND u.district_id = public.get_my_district_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "schedules_crud_leader" ON public.schedules;
CREATE POLICY "schedules_crud_leader" ON public.schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.districts d
      WHERE d.id = schedules.district_id
        AND (
          public.is_church_master(d.church_id)
          OR (
            public.is_church_leader(d.church_id)
            AND schedules.district_id = public.get_my_district_id()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.districts d
      WHERE d.id = schedules.district_id
        AND (
          public.is_church_master(d.church_id)
          OR (
            public.is_church_leader(d.church_id)
            AND schedules.district_id = public.get_my_district_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "attendances_leader" ON public.attendances;
CREATE POLICY "attendances_leader" ON public.attendances
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.schedules s
      JOIN public.districts d ON d.id = s.district_id
      WHERE s.id = attendances.schedule_id
        AND (
          public.is_church_master(d.church_id)
          OR (
            public.is_church_leader(d.church_id)
            AND s.district_id = public.get_my_district_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "weekly_reports_crud_leader" ON public.weekly_reports;
CREATE POLICY "weekly_reports_crud_leader" ON public.weekly_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.districts d
      WHERE d.id = weekly_reports.district_id
        AND (
          public.is_church_master(d.church_id)
          OR (
            public.is_church_leader(d.church_id)
            AND weekly_reports.district_id = public.get_my_district_id()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.districts d
      WHERE d.id = weekly_reports.district_id
        AND (
          public.is_church_master(d.church_id)
          OR (
            public.is_church_leader(d.church_id)
            AND weekly_reports.district_id = public.get_my_district_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "notifications_insert_leader" ON public.notifications;
DROP POLICY IF EXISTS "leader can insert notifications" ON public.notifications;
CREATE POLICY "notifications_insert_leader" ON public.notifications
  FOR INSERT WITH CHECK (
    public.is_active()
    AND (
      -- service scope is global and must be reserved for service_role/system jobs.
      -- Authenticated church admins should create district-scoped notifications only.
      (scope_type = 'service' AND false)
      OR EXISTS (
        SELECT 1
        FROM public.districts d
        WHERE d.id = notifications.district_id
          AND (
            public.is_church_master(d.church_id)
            OR (
              public.is_church_leader(d.church_id)
              AND notifications.district_id = public.get_my_district_id()
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "notifications_delete_leader" ON public.notifications;
DROP POLICY IF EXISTS "leader can delete notifications" ON public.notifications;
CREATE POLICY "notifications_delete_leader" ON public.notifications
  FOR DELETE USING (
    CASE
      WHEN scope_type = 'service' THEN false
      ELSE EXISTS (
        SELECT 1
        FROM public.districts d
        WHERE d.id = notifications.district_id
          AND (
            public.is_church_master(d.church_id)
            OR (
              public.is_church_leader(d.church_id)
              AND notifications.district_id = public.get_my_district_id()
            )
          )
      )
    END
  );

DROP POLICY IF EXISTS "prayer_responses_leader_shared" ON public.prayer_responses;
CREATE POLICY "prayer_responses_leader_shared" ON public.prayer_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.prayer_requests pr
      JOIN public.users u ON u.id = pr.user_id
      WHERE pr.id = prayer_responses.prayer_request_id
        AND pr.shared_with_leader = true
        AND (
          public.is_church_master(u.church_id)
          OR (
            public.is_church_leader(u.church_id)
            AND u.district_id = public.get_my_district_id()
          )
        )
    )
  );

DROP POLICY IF EXISTS "prayer_intercessions_group" ON public.prayer_intercessions;
CREATE POLICY "prayer_intercessions_group" ON public.prayer_intercessions
  FOR SELECT USING (
    public.is_active()
    AND EXISTS (
      SELECT 1
      FROM public.prayer_requests pr
      JOIN public.users u ON u.id = pr.user_id
      WHERE pr.id = prayer_intercessions.prayer_request_id
        AND pr.shared_with_group = true
        AND u.church_id = public.get_my_church_id()
    )
  );

-- ============================================================
-- 6. auth 신규 가입 트리거 업데이트
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_role TEXT;
  user_status TEXT;
  user_district_id UUID;
  user_church_id UUID;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  user_district_id := (NEW.raw_user_meta_data->>'district_id')::UUID;
  IF user_district_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.districts d
    JOIN public.churches c ON c.id = d.church_id
    WHERE d.id = user_district_id
      AND d.is_active = true
      AND c.status IN ('active', 'trialing')
  ) THEN
    SELECT d.id INTO user_district_id
    FROM public.districts d
    JOIN public.churches c ON c.id = d.church_id
    WHERE d.is_active = true
      AND c.status IN ('active', 'trialing')
    ORDER BY d.created_at
    LIMIT 1;
  END IF;

  SELECT church_id INTO user_church_id
  FROM public.districts
  WHERE id = user_district_id;

  IF user_church_id IS NULL THEN
    user_church_id := '00000000-0000-4100-a000-000000000001';
  END IF;

  IF NEW.email = 'cmhyun@gmail.com' THEN
    user_role := 'master';
    user_status := 'active';
  ELSIF NEW.email = 'bethel803leader@gmail.com' THEN
    user_role := 'leader';
    user_status := 'active';
  ELSIF NOT EXISTS (SELECT 1 FROM public.users WHERE church_id = user_church_id) THEN
    user_role := 'master';
    user_status := 'active';
  ELSE
    user_role := 'member';
    user_status := 'pending';
  END IF;

  INSERT INTO public.users (id, name, role, status, district_id, church_id)
  VALUES (NEW.id, user_name, user_role, user_status, user_district_id, user_church_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. 마이그레이션 검증용 조회
-- ============================================================
-- SELECT c.name AS church_name, d.name AS district_name, count(u.id) AS user_count
-- FROM public.churches c
-- JOIN public.districts d ON d.church_id = c.id
-- LEFT JOIN public.users u ON u.district_id = d.id
-- GROUP BY c.name, d.name
-- ORDER BY c.name, d.name;
