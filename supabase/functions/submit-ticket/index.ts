// Edge Function: submit-ticket
// 사용자 문의 접수 → support_tickets INSERT → GitHub Issue 생성

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') ?? '';
const GITHUB_REPO_OWNER = Deno.env.get('GITHUB_REPO_OWNER') ?? 'inje21c';
const GITHUB_REPO_NAME = Deno.env.get('GITHUB_REPO_NAME') ?? 'bethel803';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TICKET_TYPE_LABELS: Record<string, string> = {
  bug: '버그/오류',
  feature: '기능 요청',
  question: '사용 질문',
  other: '기타',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ ok: false, error: 'Unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // JWT 검증으로 호출자 식별
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authError || !user) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: { ticket_type?: string; title?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const { ticket_type, title, content } = body;
  if (!ticket_type || !title?.trim() || !content?.trim()) {
    return json({ ok: false, error: 'ticket_type, title, content 필수' }, 400);
  }
  if (!['bug', 'feature', 'question', 'other'].includes(ticket_type)) {
    return json({ ok: false, error: '유효하지 않은 ticket_type' }, 400);
  }

  // 호출자 프로필 조회
  const { data: profile } = await supabase
    .from('users')
    .select('name, role, church_id, status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'active') {
    return json({ ok: false, error: '활성 계정만 문의 가능합니다.' }, 403);
  }

  // 교회 정보 조회
  const { data: church } = await supabase
    .from('churches')
    .select('name, slug')
    .eq('id', profile.church_id)
    .single();

  // support_tickets INSERT
  const { data: ticket, error: insertError } = await supabase
    .from('support_tickets')
    .insert({
      church_id: profile.church_id,
      user_id: user.id,
      ticket_type,
      title: title.trim(),
      content: content.trim(),
    })
    .select('id, created_at')
    .single();

  if (insertError || !ticket) {
    console.error('support_tickets insert error:', insertError?.message);
    return json({ ok: false, error: '문의 저장 실패' }, 500);
  }

  // GitHub Issue 생성
  let issueNumber: number | null = null;
  let issueUrl: string | null = null;

  if (GITHUB_TOKEN) {
    try {
      const issueResult = await createGitHubIssue({
        ticketId: ticket.id,
        ticketType: ticket_type,
        title: title.trim(),
        content: content.trim(),
        churchName: church?.name ?? profile.church_id,
        churchSlug: church?.slug ?? 'unknown',
        userRole: profile.role,
        createdAt: ticket.created_at,
      });
      issueNumber = issueResult.number;
      issueUrl = issueResult.html_url;

      await supabase
        .from('support_tickets')
        .update({ github_issue_number: issueNumber, github_issue_url: issueUrl })
        .eq('id', ticket.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('GitHub issue creation failed (non-fatal):', msg);
    }
  } else {
    console.warn('GITHUB_TOKEN not set; skipping GitHub issue creation');
  }

  return json({
    ok: true,
    ticketId: ticket.id,
    issueUrl,
  });
});

async function createGitHubIssue(opts: {
  ticketId: string;
  ticketType: string;
  title: string;
  content: string;
  churchName: string;
  churchSlug: string;
  userRole: string;
  createdAt: string;
}): Promise<{ number: number; html_url: string }> {
  const typeLabel = TICKET_TYPE_LABELS[opts.ticketType] ?? opts.ticketType;
  const kstDate = new Date(new Date(opts.createdAt).getTime() + 9 * 3600 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 16) + ' KST';

  const issueBody = `## 문의 내용\n${opts.content}\n\n---\n**유형**: ${typeLabel}\n**교회**: ${opts.churchName} (${opts.churchSlug})\n**역할**: ${opts.userRole}\n**제출일**: ${kstDate}\n**티켓 ID**: ${opts.ticketId}`;

  const labels = ['support', opts.ticketType, `church:${opts.churchSlug}`];

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: `[문의] ${opts.title} — ${opts.churchSlug}`,
        body: issueBody,
        labels,
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json();
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
