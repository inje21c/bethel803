// Supabase Edge Function: scheduled-notifications
// 두 가지 cron으로 호출됨:
//   QT 알림:   매일    22:00 UTC (07:00 KST) → ?type=qt
//   성경읽기:  일요일  00:00 UTC (09:00 KST) → ?type=reading

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUSH_DISPATCH_SECRET = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'qt';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: unknown[] = [];

  try {
    if (type === 'qt') {
      results.push(await sendQTPush(supabase));
    } else if (type === 'reading') {
      results.push(await sendReadingPush(supabase));
    }

    return new Response(JSON.stringify({ ok: true, type, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('scheduled-notifications error:', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function sendQTPush(supabase: ReturnType<typeof createClient>) {
  const today = getKSTDate();

  const { data: qt } = await supabase
    .from('qt_contents')
    .select('title, scripture')
    .eq('date', today)
    .maybeSingle();

  const title = qt?.title ? `🔥 ${qt.title}` : '🔥 오늘의 QT가 준비됐어요';
  const body = qt?.scripture ?? '매일성경 말씀으로 하루를 시작해보세요';

  return await createAndDispatch(supabase, {
    title,
    body,
    notificationType: 'devotional',
    scopeType: 'service',
    districtId: null,
    url: '/qt',
  });
}

async function sendReadingPush(supabase: ReturnType<typeof createClient>) {
  return await createAndDispatch(supabase, {
    title: '📖 이번 주 성경읽기 기록하셨나요?',
    body: '한 주간 읽은 장수를 기록하고 챌린지를 이어가세요!',
    notificationType: 'reading_weekly',
    scopeType: 'service',
    districtId: null,
    url: '/bible-reading',
  });
}

async function createAndDispatch(
  supabase: ReturnType<typeof createClient>,
  params: {
    title: string;
    body: string;
    notificationType: string;
    scopeType: 'service' | 'district';
    districtId: string | null;
    url: string;
  },
) {
  const { data: notif, error } = await supabase
    .from('notifications')
    .insert({
      title: params.title,
      body: params.body,
      scope_type: params.scopeType,
      notification_type: params.notificationType,
      district_id: params.districtId,
      payload: { url: params.url },
    })
    .select('id')
    .single();

  if (error) throw new Error(`notification insert: ${error.message}`);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/push-dispatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'x-dispatch-secret': PUSH_DISPATCH_SECRET,
    },
    body: JSON.stringify({
      notificationId: notif.id,
      notificationType: params.notificationType,
      scopeType: params.scopeType,
      districtId: params.districtId,
      dryRun: false,
    }),
  });

  const result = await res.json();
  console.log(`dispatch [${params.notificationType}]:`, JSON.stringify(result));
  return result;
}

function getKSTDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
