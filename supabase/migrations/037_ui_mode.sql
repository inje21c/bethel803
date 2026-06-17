-- ============================================================
-- 037. church_settings.ui_mode — 구역장 UI 복잡도 제어
-- ============================================================
-- 'simple': 신규 구역장 대상 — 핵심 기능만 노출
-- 'full'  : 숙련 구역장 / legacy 교회 — 전체 기능 노출
--
-- 기존 legacy 교회는 'full'로 유지 (기존 사용자 혼란 방지).
-- 신규 교회는 handle_new_user가 church_settings를 생성할 때 DEFAULT 'simple' 적용.

ALTER TABLE public.church_settings
  ADD COLUMN IF NOT EXISTS ui_mode TEXT NOT NULL DEFAULT 'simple'
    CHECK (ui_mode IN ('simple', 'full'));

-- 기존 legacy 교회는 'full' 유지
UPDATE public.church_settings cs
SET ui_mode = 'full'
FROM public.churches c
WHERE cs.church_id = c.id
  AND c.plan = 'legacy';
