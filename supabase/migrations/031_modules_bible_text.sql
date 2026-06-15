-- 벧엘교회 기존 modules에 bible_text: true 추가
-- 신규 교회는 modules 기본값 {} → bible_text 없음 → 외부 링크 fallback
UPDATE public.church_settings
SET modules = modules || '{"bible_text": true}'::jsonb
WHERE church_id = '00000000-0000-4100-a000-000000000001';
