import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ResetRequest = {
  userId?: string;
  newPassword?: string;
};

type ActorProfile = {
  id: string;
  role: 'master' | 'leader' | 'member';
  district_id: string | null;
  church_id: string | null;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// 헷갈리는 문자(0/O, 1/l/I)를 제외한 임시 비밀번호 생성
function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

async function resolveActor(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<ActorProfile | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, role, district_id, church_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) return null;
  return profile as ActorProfile;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const actor = await resolveActor(req, supabase);
  if (!actor) {
    return jsonResponse(401, { ok: false, error: '인증이 필요합니다.' });
  }
  if (actor.role !== 'master') {
    return jsonResponse(403, { ok: false, error: '마스터만 비밀번호를 초기화할 수 있습니다.' });
  }

  let body: ResetRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: '잘못된 요청입니다.' });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return jsonResponse(400, { ok: false, error: 'userId가 필요합니다.' });
  }
  if (userId === actor.id) {
    return jsonResponse(400, { ok: false, error: '본인 비밀번호는 프로필에서 변경해주세요.' });
  }

  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('id, name, role, church_id')
    .eq('id', userId)
    .single();

  if (targetError || !target) {
    return jsonResponse(404, { ok: false, error: '대상 사용자를 찾을 수 없습니다.' });
  }
  if (target.role === 'master') {
    return jsonResponse(403, { ok: false, error: '마스터 계정은 초기화할 수 없습니다.' });
  }
  if (target.church_id !== actor.church_id) {
    return jsonResponse(403, { ok: false, error: '같은 교회 구성원만 초기화할 수 있습니다.' });
  }

  const newPassword = body.newPassword?.trim() || generateTempPassword();
  if (newPassword.length < 6) {
    return jsonResponse(400, { ok: false, error: '비밀번호는 6자 이상이어야 합니다.' });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    console.error('admin-reset-password failed:', updateError.message);
    return jsonResponse(500, { ok: false, error: '비밀번호 초기화에 실패했습니다.' });
  }

  console.log(`password reset: actor=${actor.id} target=${userId}`);
  return jsonResponse(200, { ok: true, userName: target.name, tempPassword: newPassword });
});
