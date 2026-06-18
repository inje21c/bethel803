// Edge Function: github-webhook
// GitHub Issues/Comments 이벤트 수신 → support_tickets 업데이트 + 푸시 알림

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GITHUB_WEBHOOK_SECRET = Deno.env.get('GITHUB_WEBHOOK_SECRET') ?? '';
const PUSH_DISPATCH_SECRET = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();

  // HMAC 서명 검증 — 시크릿 미설정 시 fail-closed
  if (!GITHUB_WEBHOOK_SECRET) {
    console.error('github-webhook: GITHUB_WEBHOOK_SECRET not configured');
    return new Response('Service Unavailable', { status: 503 });
  }
  const sig = req.headers.get('x-hub-signature-256') ?? '';
  const valid = await verifySignature(rawBody, sig, GITHUB_WEBHOOK_SECRET);
  if (!valid) {
    console.warn('github-webhook: invalid signature');
    return new Response('Unauthorized', { status: 401 });
  }

  const event = req.headers.get('x-github-event') ?? '';
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    await handleEvent(supabase, event, payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('github-webhook handler error:', msg);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(null, { status: 204 });
});

async function handleEvent(
  supabase: ReturnType<typeof createClient>,
  event: string,
  payload: Record<string, unknown>,
) {
  const issue = payload.issue as Record<string, unknown> | undefined;
  if (!issue) return;

  const issueNumber = issue.number as number;
  const action = payload.action as string;

  // issue_comment created: 답변 저장
  if (event === 'issue_comment' && action === 'created') {
    const comment = payload.comment as Record<string, unknown>;
    const commentBody = (comment?.body as string) ?? '';
    const senderLogin = (payload.sender as Record<string, unknown>)?.login as string;

    // 봇 코멘트 무시
    if (senderLogin?.endsWith('[bot]') || senderLogin === 'github-actions') return;
    // 이슈 열람자 자신의 코멘트면 패스 (티켓 등록자가 아닌 개발자 답변만)
    // 여기서는 모든 코멘트를 답변으로 처리 (개발자가 직접 코멘트)

    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, user_id, status')
      .eq('github_issue_number', issueNumber)
      .maybeSingle();

    if (!ticket) return;

    await supabase
      .from('support_tickets')
      .update({
        admin_reply: commentBody,
        replied_at: new Date().toISOString(),
        reply_read_at: null,
        status: ticket.status === 'open' ? 'in_progress' : ticket.status,
      })
      .eq('id', ticket.id);

    await dispatchPush(supabase, ticket.user_id, '문의에 답변이 등록되었습니다.');
    return;
  }

  // issues closed: resolved 처리
  if (event === 'issues' && action === 'closed') {
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, user_id')
      .eq('github_issue_number', issueNumber)
      .maybeSingle();

    if (!ticket) return;

    await supabase
      .from('support_tickets')
      .update({ status: 'resolved' })
      .eq('id', ticket.id);

    await dispatchPush(supabase, ticket.user_id, '문의가 처리 완료되었습니다.');
    return;
  }

  // issues reopened
  if (event === 'issues' && action === 'reopened') {
    await supabase
      .from('support_tickets')
      .update({ status: 'open' })
      .eq('github_issue_number', issueNumber);
    return;
  }
}

async function dispatchPush(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  message: string,
) {
  try {
    await supabase.functions.invoke('push-dispatch', {
      body: {
        scope: 'user',
        user_id: userId,
        notification_type: 'service_notice',
        title: '벧엘구역',
        body: message,
      },
      headers: { 'x-dispatch-secret': PUSH_DISPATCH_SECRET },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('push-dispatch error (non-fatal):', msg);
  }
}

async function verifySignature(body: string, sig: string, secret: string): Promise<boolean> {
  if (!sig.startsWith('sha256=')) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  const expected = `sha256=${hex}`;
  // timing-safe compare
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}
