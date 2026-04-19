-- 018: 시스템 자동화 알림 지원
-- created_by NULL 허용 (자동화 알림은 발송자 없음)
ALTER TABLE public.notifications ALTER COLUMN created_by DROP NOT NULL;
