-- ============================================================
-- 개발용 임시 설정: 로그인 없이 Supabase DB 직접 접근
-- Phase 2 (로그인 스킵) 기간에만 적용
-- 실제 로그인 구현(Phase 2-3) 완료 후 이 파일은 삭제할 것
-- ============================================================

-- 1. users.id FK 제거 (mock user 삽입 가능하도록)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. 개발용 mock user 삽입
--    authContext.tsx의 MOCK_USER.id와 동일한 UUID 사용
INSERT INTO public.users (id, name, role, status)
VALUES ('00000000-0000-0000-0000-000000000001', '개발자', 'leader', 'active')
ON CONFLICT DO NOTHING;

-- 3. anon 역할에 스키마 및 테이블 접근 권한 부여
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 4. 각 테이블에 anon 전체 허용 RLS 정책 추가
--    (기존 auth.uid() 기반 정책과 병행 — OR 조건으로 동작)

CREATE POLICY "dev_anon_users" ON public.users
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_bible_studies" ON public.bible_studies
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_study_answers" ON public.study_answers
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_prayer_requests" ON public.prayer_requests
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_bible_reading_logs" ON public.bible_reading_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_schedules" ON public.schedules
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_attendances" ON public.attendances
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_daily_devotionals" ON public.daily_devotionals
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dev_anon_weekly_reports" ON public.weekly_reports
  FOR ALL TO anon USING (true) WITH CHECK (true);
