import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUSH_DISPATCH_SECRET = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
const WEB_PUSH_VAPID_PUBLIC_KEY =
  Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')
  ?? Deno.env.get('VITE_VAPID_PUBLIC_KEY')
  ?? '';
const WEB_PUSH_VAPID_PRIVATE_KEY = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY') ?? '';
const WEB_PUSH_VAPID_SUBJECT = Deno.env.get('WEB_PUSH_VAPID_SUBJECT') ?? 'mailto:admin@example.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dispatch-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type NotificationType =
  | 'general'
  | 'schedule'
  | 'schedule_rsvp'
  | 'study'
  | 'devotional'
  | 'prayer'
  | 'reading_weekly'
  | 'service_notice';

type ScopeType = 'district' | 'service';

type DispatchRequest = {
  dryRun?: boolean;
  notificationId?: string;
  districtId?: string | null;
  userId?: string | null;
  title?: string;
  body?: string;
  url?: string;
  notificationType?: NotificationType;
  scopeType?: ScopeType;
};

type ActorProfile = {
  id: string;
  role: 'master' | 'leader' | 'member';
  district_id: string | null;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  district_id: string | null;
  scope_type: ScopeType;
  notification_type: NotificationType;
  payload: Record<string, unknown> | null;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  district_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  is_active: boolean;
};

type PreferenceRow = {
  user_id: string;
  schedule_enabled: boolean;
  study_enabled: boolean;
  devotional_enabled: boolean;
  prayer_enabled: boolean;
  reading_weekly_enabled: boolean;
  service_notice_enabled: boolean;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isSendReady() {
  return Boolean(WEB_PUSH_VAPID_PUBLIC_KEY && WEB_PUSH_VAPID_PRIVATE_KEY && WEB_PUSH_VAPID_SUBJECT);
}

function applyPreferenceFilter(type: NotificationType, pref?: PreferenceRow) {
  if (!pref) return true;
  switch (type) {
    case 'schedule':
    case 'schedule_rsvp':
      return pref.schedule_enabled;
    case 'study':
      return pref.study_enabled;
    case 'devotional':
      return pref.devotional_enabled;
    case 'prayer':
      return pref.prayer_enabled;
    case 'reading_weekly':
      return pref.reading_weekly_enabled;
    case 'service_notice':
      return pref.service_notice_enabled;
    case 'general':
    default:
      return true;
  }
}

function shortEndpoint(endpoint: string) {
  return endpoint.length <= 24 ? endpoint : `${endpoint.slice(0, 12)}...${endpoint.slice(-12)}`;
}

async function authorize(req: Request, supabase: ReturnType<typeof createClient>) {
  const dispatchSecret = req.headers.get('x-dispatch-secret');
  if (PUSH_DISPATCH_SECRET && dispatchSecret === PUSH_DISPATCH_SECRET) {
    return { mode: 'secret' as const, actor: null };
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, role, district_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) return null;
  const actor = profile as ActorProfile;
  if (actor.role !== 'leader' && actor.role !== 'master') return null;

  return { mode: 'user' as const, actor };
}

async function loadNotification(
  supabase: ReturnType<typeof createClient>,
  notificationId: string,
): Promise<NotificationRow | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, district_id, scope_type, notification_type, payload')
    .eq('id', notificationId)
    .maybeSingle();

  if (error || !data) return null;
  return data as NotificationRow;
}

async function loadTargetSubscriptions(
  supabase: ReturnType<typeof createClient>,
  params: { districtId?: string | null; userId?: string | null },
) {
  let query = supabase
    .from('push_subscriptions')
    .select('id, user_id, district_id, endpoint, p256dh, auth, platform, is_active')
    .eq('is_active', true);

  if (params.userId) {
    query = query.eq('user_id', params.userId);
  } else if (params.districtId) {
    query = query.eq('district_id', params.districtId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SubscriptionRow[];
}

async function loadPreferences(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
) {
  if (userIds.length === 0) return new Map<string, PreferenceRow>();

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('user_id, schedule_enabled, study_enabled, devotional_enabled, prayer_enabled, reading_weekly_enabled, service_notice_enabled')
    .in('user_id', userIds);

  if (error) throw error;

  return new Map((data ?? []).map((row) => [row.user_id, row as PreferenceRow]));
}

async function ensureLeaderScope(
  supabase: ReturnType<typeof createClient>,
  actor: ActorProfile,
  params: { districtId?: string | null; userId?: string | null; scopeType: ScopeType },
) {
  if (actor.role !== 'leader') return;

  if (params.scopeType === 'service') {
    throw new Error('구역장은 서비스 공지 푸시를 발송할 수 없습니다.');
  }

  if (params.userId) {
    const { data } = await supabase
      .from('users')
      .select('district_id')
      .eq('id', params.userId)
      .maybeSingle();

    if ((data as { district_id: string | null } | null)?.district_id !== actor.district_id) {
      throw new Error('구역장은 자기 구역 사용자에게만 발송할 수 있습니다.');
    }
    return;
  }

  if (params.districtId && params.districtId !== actor.district_id) {
    throw new Error('구역장은 자기 구역에만 발송할 수 있습니다.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'POST only' }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const auth = await authorize(req, supabase);
    if (!auth) {
      return jsonResponse({ ok: false, error: '권한이 없습니다.' }, 401);
    }

    const body = await req.json().catch(() => ({})) as DispatchRequest;
    const dryRun = body.dryRun !== false;

    let notification: NotificationRow | null = null;
    if (body.notificationId) {
      notification = await loadNotification(supabase, body.notificationId);
      if (!notification) {
        return jsonResponse({ ok: false, error: 'notification not found' }, 404);
      }
    }

    const scopeType = body.scopeType ?? notification?.scope_type ?? 'district';
    const notificationType = body.notificationType ?? notification?.notification_type ?? 'general';
    const districtId =
      body.userId
        ? null
        : (body.districtId ?? notification?.district_id ?? auth.actor?.district_id ?? null);
    const userId = body.userId ?? null;
    const title = body.title ?? notification?.title ?? '';
    const payload = notification?.payload ?? {};
    const pushUrl =
      body.url
      ?? (typeof payload?.url === 'string' ? payload.url : null)
      ?? (notification ? '/dashboard' : '/dashboard');
    const messageBody = body.body ?? notification?.body ?? '';

    if (!title || !messageBody) {
      return jsonResponse({ ok: false, error: 'title and body are required' }, 400);
    }

    if (auth.actor) {
      await ensureLeaderScope(supabase, auth.actor, { districtId, userId, scopeType });
    }

    const subscriptions = await loadTargetSubscriptions(supabase, {
      districtId: userId ? null : districtId,
      userId,
    });

    const preferences = await loadPreferences(
      supabase,
      [...new Set(subscriptions.map((item) => item.user_id))],
    );

    const targetSubscriptions = subscriptions.filter((item) =>
      applyPreferenceFilter(notificationType, preferences.get(item.user_id)),
    );

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dryRun: true,
        notificationId: notification?.id ?? null,
        scopeType,
        notificationType,
        targetCount: targetSubscriptions.length,
        targets: targetSubscriptions.map((item) => ({
          subscriptionId: item.id,
          userId: item.user_id,
          districtId: item.district_id,
          platform: item.platform,
          endpoint: shortEndpoint(item.endpoint),
        })),
      });
    }

    if (!notification?.id) {
      return jsonResponse({ ok: false, error: 'actual dispatch requires notificationId' }, 400);
    }

    if (!isSendReady()) {
      return jsonResponse({ ok: false, error: 'web push VAPID secrets are not configured' }, 500);
    }

    webpush.setVapidDetails(
      WEB_PUSH_VAPID_SUBJECT,
      WEB_PUSH_VAPID_PUBLIC_KEY,
      WEB_PUSH_VAPID_PRIVATE_KEY,
    );

    const results: Array<{ subscriptionId: string; status: string; code: number | null; error: string | null }> = [];
    let sentCount = 0;
    let failedCount = 0;
    let expiredCount = 0;

    for (const subscription of targetSubscriptions) {
      const { data: deliveryRow, error: deliveryInsertError } = await supabase
        .from('push_deliveries')
        .insert({
          notification_id: notification.id,
          subscription_id: subscription.id,
          user_id: subscription.user_id,
          district_id: subscription.district_id,
          delivery_type: 'push',
          status: 'pending',
          attempt_count: 1,
        })
        .select('id')
        .single();

      if (deliveryInsertError || !deliveryRow) {
        failedCount += 1;
        results.push({
          subscriptionId: subscription.id,
          status: 'failed',
          code: null,
          error: deliveryInsertError?.message ?? 'delivery insert failed',
        });
        continue;
      }
      const delivery = deliveryRow as { id: string };

      try {
        const response = await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title,
            body: messageBody,
            url: pushUrl,
            tag: `${notification.notification_type}:${notification.id}`,
            notificationId: notification.id,
            notificationType,
          }),
        );

        await supabase
          .from('push_deliveries')
          .update({
            status: 'sent',
            response_code: response.statusCode ?? null,
            sent_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);

        sentCount += 1;
        results.push({
          subscriptionId: subscription.id,
          status: 'sent',
          code: response.statusCode ?? null,
          error: null,
        });
      } catch (error) {
        const statusCode = typeof error === 'object' && error && 'statusCode' in error
          ? Number((error as { statusCode?: number }).statusCode ?? 0)
          : null;
        const message = error instanceof Error ? error.message : String(error);
        const expired = statusCode === 404 || statusCode === 410;

        await supabase
          .from('push_deliveries')
          .update({
            status: expired ? 'expired' : 'failed',
            response_code: statusCode,
            error_message: message,
          })
          .eq('id', delivery.id);

        if (expired) {
          await supabase
            .from('push_subscriptions')
            .update({
              is_active: false,
              last_seen_at: new Date().toISOString(),
            })
            .eq('id', subscription.id);
          expiredCount += 1;
        } else {
          failedCount += 1;
        }

        results.push({
          subscriptionId: subscription.id,
          status: expired ? 'expired' : 'failed',
          code: statusCode,
          error: message,
        });
      }
    }

    return jsonResponse({
      ok: true,
      dryRun: false,
      notificationId: notification.id,
      targetCount: targetSubscriptions.length,
      sentCount,
      failedCount,
      expiredCount,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('push-dispatch error:', message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
