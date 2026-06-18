-- migration 047: support_tickets UPDATE 정책 보안 수정
-- 기존 정책이 모든 컬럼 수정을 허용하던 문제 수정
-- reply_read_at 전용 RPC로 교체하여 사용자가 status/admin_reply 등을 조작하지 못하도록 함

-- 기존 과도한 UPDATE 정책 제거
DROP POLICY IF EXISTS "support_tickets_update_own_read" ON public.support_tickets;

-- reply_read_at 표시 전용 RPC (컬럼 수준 제어)
CREATE OR REPLACE FUNCTION public.mark_ticket_read(p_ticket_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets
  SET reply_read_at = NOW()
  WHERE id = p_ticket_id
    AND user_id = auth.uid()
    AND reply_read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_ticket_read(UUID) TO authenticated;

-- 관리자(master)용 UPDATE 정책: status/admin_reply 등 관리 컬럼만 허용
-- service_role(Edge Function github-webhook)은 RLS 우회하므로 별도 정책 불필요
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'support_tickets_update_master'
  ) THEN
    CREATE POLICY "support_tickets_update_master"
      ON public.support_tickets FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role = 'master'
            AND church_id = support_tickets.church_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role = 'master'
            AND church_id = support_tickets.church_id
        )
      );
  END IF;
END $$;
