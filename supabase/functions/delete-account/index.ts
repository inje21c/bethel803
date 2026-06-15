import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // 호출자 JWT로 user_id 확인
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: '인증 필요' }), { status: 401, headers: corsHeaders });

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: '인증 실패' }), { status: 401, headers: corsHeaders });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 현재 사용자의 역할과 교회 확인
    const { data: profile } = await adminClient
      .from('users')
      .select('id, role, church_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) return new Response(JSON.stringify({ error: '사용자 정보 없음' }), { status: 404, headers: corsHeaders });

    const churchId = profile.church_id;

    if (profile.role === 'master' && churchId) {
      // 같은 교회의 다른 active 구성원 수 확인
      const { count } = await adminClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('church_id', churchId)
        .neq('id', user.id)
        .eq('status', 'active');

      if ((count ?? 0) > 0) {
        return new Response(
          JSON.stringify({ error: 'master_has_members', message: '다른 구성원이 있습니다. 먼저 다른 구성원에게 권한을 이전하거나 모든 구성원을 삭제해주세요.' }),
          { status: 409, headers: corsHeaders }
        );
      }

      // 교회 전체 삭제 (CASCADE: church_settings, districts, users)
      // users 먼저 삭제 (FK 제약)
      await adminClient.from('users').delete().eq('church_id', churchId);
      await adminClient.from('districts').delete().eq('church_id', churchId);
      await adminClient.from('church_settings').delete().eq('church_id', churchId);
      await adminClient.from('churches').delete().eq('id', churchId);
    } else {
      // 일반 멤버: 본인 데이터만 삭제
      await adminClient.from('users').delete().eq('id', user.id);
    }

    // auth.users에서 삭제
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
