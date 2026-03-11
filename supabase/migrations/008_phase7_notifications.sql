-- Phase 7-5: 앱 내 알림 센터
-- 구역장이 알림을 발행하면 모든 active 구역원에게 노출

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

-- RLS: 모든 active 구역원이 조회 가능
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active users can read notifications"
  ON notifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "leader can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'leader' AND status = 'active')
  );

CREATE POLICY "leader can delete notifications"
  ON notifications FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'leader' AND status = 'active')
  );

CREATE POLICY "users can insert own reads"
  ON notification_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can read own reads"
  ON notification_reads FOR SELECT
  USING (user_id = auth.uid());

-- Phase 7-1: Supabase Storage 'attachments' 버킷은 대시보드에서 생성 필요
-- Storage > New bucket > Name: attachments, Public: true
