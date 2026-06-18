// Supabase Edge Function: event-notifications
// Supabase Database Webhook으로 호출됨 (INSERT/UPDATE 이벤트)
//
// Webhook 설정 (Supabase 대시보드 → Database → Webhooks):
//   1. on-bible-study-published     bible_studies   UPDATE  → .../functions/v1/event-notifications
//   2. on-schedule-insert           schedules       INSERT  → .../functions/v1/event-notifications
//   3. on-prayer-request-intercession prayer_requests UPDATE → .../functions/v1/event-notifications
//
// Header: x-webhook-secret: <EVENT_WEBHOOK_SECRET>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUSH_DISPATCH_SECRET = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
const EVENT_WEBHOOK_SECRET = Deno.env.get('EVENT_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // Webhook 시크릿 검증 — 시크릿 미설정 시 fail-closed
  if (!EVENT_WEBHOOK_SECRET) {
    console.error('event-notifications: EVENT_WEBHOOK_SECRET not configured');
    return new Response(JSON.stringify({ error: 'Service Unavailable' }), { status: 503 });
  }
  const incoming = req.headers.get('x-webhook-secret');
  if (incoming !== EVENT_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
  }

  const { type, table, record, old_record } = payload;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const notifParams = await resolveNotification(supabase, table, type, record, old_record);

    if (!notifParams) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 알림 레코드 생성
    const { data: notif, error: notifError } = await supabase
      .from('notifications')
      .insert({
        title: notifParams.title,
        body: notifParams.body,
        scope_type: 'district',
        notification_type: notifParams.notificationType,
        district_id: notifParams.districtId,
        payload: { url: notifParams.url },
      })
      .select('id')
      .single();

    if (notifError) throw new Error(`notification insert: ${notifError.message}`);

    // push-dispatch 호출
    const res = await fetch(`${SUPABASE_URL}/functions/v1/push-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'x-dispatch-secret': PUSH_DISPATCH_SECRET,
      },
      body: JSON.stringify({
        notificationId: notif.id,
        notificationType: notifParams.notificationType,
        scopeType: 'district',
        districtId: notifParams.districtId,
        dryRun: false,
      }),
    });

    const result = await res.json();
    console.log(`event-push [${table}/${type}]:`, JSON.stringify(result));

    return new Response(JSON.stringify({ ok: true, notificationId: notif.id, dispatch: result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('event-notifications error:', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

interface NotifParams {
  title: string;
  body: string;
  notificationType: string;
  districtId: string | null;
  url: string;
}

async function resolveNotification(
  supabase: ReturnType<typeof createClient>,
  table: string,
  type: string,
  record: Record<string, unknown>,
  oldRecord: Record<string, unknown> | null,
): Promise<NotifParams | null> {

  // 성경공부 발행 (UPDATE: published false → true)
  if (table === 'bible_studies' && type === 'UPDATE') {
    if (record.published !== true || oldRecord?.published === true) return null;
    return {
      title: '📖 새 성경공부가 등록되었어요',
      body: `${record.week_number}주차 "${record.title}" 성경공부를 확인해보세요.`,
      notificationType: 'study',
      districtId: (record.district_id as string) ?? null,
      url: `/bible-study/${record.id}`,
    };
  }

  // 참여여부 일정 등록 (INSERT: rsvp_enabled=true)
  if (table === 'schedules' && type === 'INSERT') {
    if (!record.rsvp_enabled) return null;
    return {
      title: '📅 참여 여부를 알려주세요',
      body: `"${record.title}" 일정이 등록됐습니다. 참석 여부를 확인해주세요.`,
      notificationType: 'schedule_rsvp',
      districtId: (record.district_id as string) ?? null,
      url: '/schedule',
    };
  }

  // 중보기도 공개 (UPDATE: shared_with_group false → true)
  if (table === 'prayer_requests' && type === 'UPDATE') {
    if (record.shared_with_group !== true || oldRecord?.shared_with_group === true) return null;

    const { data: userRow } = await supabase
      .from('users')
      .select('district_id, name')
      .eq('id', record.user_id)
      .maybeSingle();

    if (!userRow?.district_id) return null;

    return {
      title: '🙏 새로운 중보기도 요청이 있어요',
      body: `${userRow.name}님의 기도제목이 올라왔습니다. 함께 기도해주세요.`,
      notificationType: 'prayer',
      districtId: userRow.district_id,
      url: '/prayer-requests',
    };
  }

  return null;
}
