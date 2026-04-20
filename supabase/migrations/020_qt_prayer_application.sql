-- 020: qt_contents에 AI 생성 기도문 + 오늘의 적용 컬럼 추가
ALTER TABLE public.qt_contents
  ADD COLUMN IF NOT EXISTS prayer     TEXT,
  ADD COLUMN IF NOT EXISTS application TEXT;
