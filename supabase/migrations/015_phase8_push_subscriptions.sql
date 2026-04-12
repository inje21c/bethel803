-- ============================================================
-- 015: Phase 8 웹푸시 구독 기반
-- - notifications 확장 컬럼 정리
-- - push_subscriptions
-- - notification_preferences
-- - push_deliveries
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'district',
  ADD COLUMN IF NOT EXISTS notification_type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_scope_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_scope_type_check
  CHECK (scope_type IN ('district', 'service'));

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_notification_type_check
  CHECK (
    notification_type IN (
      'general',
      'schedule',
      'schedule_rsvp',
      'study',
      'devotional',
      'prayer',
      'reading_weekly',
      'service_notice'
    )
  );

CREATE INDEX IF NOT EXISTS notifications_scope_created_idx
  ON public.notifications (scope_type, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_district_created_idx
  ON public.notifications (district_id, created_at DESC);

DROP POLICY IF EXISTS "leader can insert notifications" ON public.notifications;
CREATE POLICY "leader can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('leader', 'master')
    )
  );

DROP POLICY IF EXISTS "leader can delete notifications" ON public.notifications;
CREATE POLICY "leader can delete notifications" ON public.notifications
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('leader', 'master')
    )
  );

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  user_agent TEXT,
  app_version TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS push_subscriptions_user_active_idx
  ON public.push_subscriptions (user_id, is_active);

CREATE INDEX IF NOT EXISTS push_subscriptions_district_active_idx
  ON public.push_subscriptions (district_id, is_active);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id OR public.is_master());

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id OR public.is_master())
  WITH CHECK (auth.uid() = user_id OR public.is_master());

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  schedule_enabled BOOLEAN NOT NULL DEFAULT true,
  study_enabled BOOLEAN NOT NULL DEFAULT true,
  devotional_enabled BOOLEAN NOT NULL DEFAULT true,
  prayer_enabled BOOLEAN NOT NULL DEFAULT true,
  reading_weekly_enabled BOOLEAN NOT NULL DEFAULT true,
  service_notice_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  digest_mode TEXT NOT NULL DEFAULT 'instant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_digest_mode_check;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_digest_mode_check
  CHECK (digest_mode IN ('instant', 'daily', 'weekly'));

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_select_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_select_own" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id OR public.is_master());

DROP POLICY IF EXISTS "notification_preferences_insert_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_insert_own" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_preferences_update_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_update_own" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id OR public.is_master())
  WITH CHECK (auth.uid() = user_id OR public.is_master());

CREATE TABLE IF NOT EXISTS public.push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  delivery_type TEXT NOT NULL DEFAULT 'push',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  response_code INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_deliveries
  DROP CONSTRAINT IF EXISTS push_deliveries_delivery_type_check;

ALTER TABLE public.push_deliveries
  ADD CONSTRAINT push_deliveries_delivery_type_check
  CHECK (delivery_type IN ('push'));

ALTER TABLE public.push_deliveries
  DROP CONSTRAINT IF EXISTS push_deliveries_status_check;

ALTER TABLE public.push_deliveries
  ADD CONSTRAINT push_deliveries_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'expired', 'skipped'));

DROP TRIGGER IF EXISTS push_deliveries_updated_at ON public.push_deliveries;
CREATE TRIGGER push_deliveries_updated_at
  BEFORE UPDATE ON public.push_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS push_deliveries_notification_idx
  ON public.push_deliveries (notification_id);

CREATE INDEX IF NOT EXISTS push_deliveries_subscription_status_idx
  ON public.push_deliveries (subscription_id, status);

CREATE INDEX IF NOT EXISTS push_deliveries_user_created_idx
  ON public.push_deliveries (user_id, created_at DESC);

ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_deliveries_select_master" ON public.push_deliveries;
CREATE POLICY "push_deliveries_select_master" ON public.push_deliveries
  FOR SELECT USING (public.is_master());
