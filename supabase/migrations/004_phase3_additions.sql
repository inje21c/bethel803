-- ============================================================
-- Phase 3 추가 마이그레이션
-- 1. schedules 테이블에 attachment 컬럼 추가
-- 2. users 테이블에 last_login_at 컬럼 추가
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

-- 1. schedules에 첨부자료 URL 컬럼 추가
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS attachment TEXT;

-- 2. users에 마지막 로그인 시각 컬럼 추가
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 3. users.last_login_at 업데이트 권한 정책 (본인만 가능)
-- 기존 users_update_own 정책이 커버하므로 별도 정책 불필요
