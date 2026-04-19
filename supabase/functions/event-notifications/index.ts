// Supabase Edge Function: event-notifications
// Supabase Database Webhook으로 호출됨 (INSERT/UPDATE 이벤트)
//
// Webhook 설정 (Supabase 대시보드 → Database → Webhooks):
//   1. bible_studies   UPDATE  → https://<project>.supabase.co/functions/v1/event-notifications
//   2. schedules       INSERT  → https://<project>.supabase.co/functions/v1/event-notifications
//   3. prayer_requests INSERT  → https://<project>.supabase.co/functions/v1/event-notifications
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

  // Webhook 시크릿 검증
  const incoming = req.headers.get('x-webhook-secret');
  if (EVENT_WEBHOOK_SECRET && incoming !== EVENT_WEBHOOK_SECRET) {
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

  // 중보기도 등록 (INSERT: 기도제목 공유)
  if (table === 'prayer_requests' && type === 'INSERT') {
    // 본인 기도제목이라 구역 알림 여부와 무관하게 등록 시 발송
    // user_id로 구역 조회
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
