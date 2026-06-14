-- ============================================================
-- 030: church_settings에 qt_simple_book 추가
-- simple 모드에서 사용할 성경 책 이름 (bible_books.korean_name 기준)
-- 기본값: 시편 (150장 순환)
-- 전제: 022 (bible_books), 027 (church_settings)
-- ============================================================

ALTER TABLE public.church_settings
  ADD COLUMN IF NOT EXISTS qt_simple_book TEXT NOT NULL DEFAULT '시편';
