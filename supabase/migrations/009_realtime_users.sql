-- Phase 7 Fix: users 테이블 Realtime 구독 활성화
-- 승인 대기 구역원이 구역장 승인을 실시간으로 감지하기 위해 필요

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
