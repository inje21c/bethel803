-- ============================================================
-- 026: 깊은 묵상 AI 생성물 캐시
-- 요약/질문은 날짜별 콘텐츠이므로 qt_contents에 1회 생성·공유한다.
-- (사용자별 AI 호출 → 일별 1회 호출로 토큰 절감)
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

ALTER TABLE public.qt_contents
  ADD COLUMN IF NOT EXISTS deep_summary TEXT;

ALTER TABLE public.qt_contents
  ADD COLUMN IF NOT EXISTS deep_questions JSONB;
