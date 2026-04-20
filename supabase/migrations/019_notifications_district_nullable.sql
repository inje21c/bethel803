-- 019: service-scope 알림은 district_id 없음 → NULL 허용
ALTER TABLE public.notifications ALTER COLUMN district_id DROP NOT NULL;
