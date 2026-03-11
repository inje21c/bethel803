-- ============================================================
-- Phase 6: 주보 PDF 파싱
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

-- bible_studies에 PDF 출처 URL 컬럼 추가
ALTER TABLE public.bible_studies ADD COLUMN IF NOT EXISTS source_pdf_url TEXT;
