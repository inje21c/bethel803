-- is_active() 함수가 없을 경우 대비
CREATE OR REPLACE FUNCTION public.is_active()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 중보기도 참여 (함께 기도합니다) 테이블
CREATE TABLE prayer_intercessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_request_id UUID NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(prayer_request_id, user_id)
);

ALTER TABLE prayer_intercessions ENABLE ROW LEVEL SECURITY;

-- 본인 CRUD
CREATE POLICY intercessions_own ON prayer_intercessions
  FOR ALL USING (user_id = auth.uid());

-- 중보기도 항목의 참여자 수 조회 (모든 활성 사용자)
CREATE POLICY intercessions_read ON prayer_intercessions
  FOR SELECT USING (
    public.is_active() AND EXISTS (
      SELECT 1 FROM prayer_requests
      WHERE id = prayer_intercessions.prayer_request_id
        AND shared_with_group = true
    )
  );
