-- 010: 기도제목 공유 기능 + 응답 테이블

-- 1. prayer_requests 컬럼 추가
ALTER TABLE prayer_requests
  ADD COLUMN IF NOT EXISTS shared_with_leader BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_with_group BOOLEAN NOT NULL DEFAULT false;

-- 2. prayer_responses 테이블 신규
CREATE TABLE IF NOT EXISTS prayer_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_request_id UUID NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE prayer_responses ENABLE ROW LEVEL SECURITY;

-- 3. 기존 데이터 마이그레이션 (response -> prayer_responses)
INSERT INTO prayer_responses (prayer_request_id, user_id, content, created_at)
SELECT id, user_id, response, updated_at
FROM prayer_requests
WHERE response IS NOT NULL AND response != '';

-- 4. RLS 정책 — prayer_requests
-- 기존 정책 제거 (안전하게 IF EXISTS)
DROP POLICY IF EXISTS prayer_requests_own ON prayer_requests;
DROP POLICY IF EXISTS prayer_requests_leader ON prayer_requests;
DROP POLICY IF EXISTS prayer_requests_leader_shared ON prayer_requests;
DROP POLICY IF EXISTS prayer_requests_group ON prayer_requests;
DROP POLICY IF EXISTS prayer_requests_leader_update ON prayer_requests;
DROP POLICY IF EXISTS prayer_requests_select ON prayer_requests;
DROP POLICY IF EXISTS prayer_requests_insert ON prayer_requests;
DROP POLICY IF EXISTS prayer_requests_update ON prayer_requests;
DROP POLICY IF EXISTS prayer_requests_delete ON prayer_requests;

-- 본인 CRUD
CREATE POLICY prayer_requests_own ON prayer_requests
  FOR ALL USING (user_id = auth.uid());

-- 구역장은 공유된 기도제목 조회 가능
CREATE POLICY prayer_requests_leader_shared ON prayer_requests
  FOR SELECT USING (public.is_leader() AND shared_with_leader = true);

-- 중보기도 전체 공개
CREATE POLICY prayer_requests_group ON prayer_requests
  FOR SELECT USING (shared_with_group = true AND public.is_active());

-- 구역장은 shared_with_group 업데이트 가능
CREATE POLICY prayer_requests_leader_update ON prayer_requests
  FOR UPDATE USING (public.is_leader());

-- 5. RLS 정책 — prayer_responses
CREATE POLICY prayer_responses_own ON prayer_responses
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY prayer_responses_leader_shared ON prayer_responses
  FOR SELECT USING (
    public.is_leader() AND EXISTS (
      SELECT 1 FROM prayer_requests
      WHERE id = prayer_responses.prayer_request_id
        AND shared_with_leader = true
    )
  );

CREATE POLICY prayer_responses_group ON prayer_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prayer_requests
      WHERE id = prayer_responses.prayer_request_id
        AND shared_with_group = true
    ) AND public.is_active()
  );
