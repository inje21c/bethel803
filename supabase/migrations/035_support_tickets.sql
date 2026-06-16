-- ============================================================
-- 035. 고객지원 티켓 (사용자 문의 → GitHub Issues 연동)
-- ============================================================

-- update_updated_at_column: 여러 테이블에서 공유하는 트리거 함수.
-- prod에는 이미 존재하나 staging에 없을 수 있어 OR REPLACE로 보장.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE public.support_tickets (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id            UUID        NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  ticket_type          TEXT        NOT NULL CHECK (ticket_type IN ('bug','feature','question','other')),
  title                TEXT        NOT NULL,
  content              TEXT        NOT NULL,

  status               TEXT        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open','in_progress','resolved','closed')),

  github_issue_number  INTEGER,
  github_issue_url     TEXT,

  admin_reply          TEXT,
  replied_at           TIMESTAMPTZ,
  reply_read_at        TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON public.support_tickets (church_id, created_at DESC);
CREATE INDEX ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX ON public.support_tickets (github_issue_number) WHERE github_issue_number IS NOT NULL;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- 본인 티켓 조회
CREATE POLICY "support_tickets_select_own"
  ON public.support_tickets FOR SELECT
  USING (user_id = auth.uid());

-- master: 자기 교회 전체 티켓 조회
CREATE POLICY "support_tickets_select_master"
  ON public.support_tickets FOR SELECT
  USING (
    church_id = public.get_my_church_id()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'master' AND status = 'active'
    )
  );

-- active member: 자기 교회로 제출
CREATE POLICY "support_tickets_insert_member"
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    church_id = public.get_my_church_id()
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND status = 'active'
    )
  );

-- 본인: reply_read_at 업데이트 (답변 확인 처리)
CREATE POLICY "support_tickets_update_own_read"
  ON public.support_tickets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
