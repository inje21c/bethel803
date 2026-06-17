-- ============================================================
-- 045. prayer_responses INSERT 정책 명시적 추가
-- ============================================================
-- 배경: prayer_responses_own 은 010에서 FOR ALL USING (user_id = auth.uid())로
--   생성됐으나 WITH CHECK 절이 누락돼 PostgREST 버전에 따라 INSERT가
--   거부될 수 있음. prayer_requests_own 은 012에서 DROP+CREATE로 재생성됐으나
--   prayer_responses_own 은 재생성되지 않아 INSERT 실패로 이어짐.
-- 수정: FOR INSERT WITH CHECK 정책을 명시적으로 추가하고,
--   기존 FOR ALL 정책을 WITH CHECK 포함 형태로 재생성.

-- 1. 기존 FOR ALL 정책 재생성 (WITH CHECK 명시)
DROP POLICY IF EXISTS "prayer_responses_own" ON public.prayer_responses;
CREATE POLICY "prayer_responses_own" ON public.prayer_responses
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. DELETE 는 별도 소유자 정책 (명시적 보강)
DROP POLICY IF EXISTS "prayer_responses_delete_own" ON public.prayer_responses;
CREATE POLICY "prayer_responses_delete_own" ON public.prayer_responses
  FOR DELETE
  USING (user_id = auth.uid());
