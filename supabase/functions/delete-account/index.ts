import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SOFT_DELETE_GRACE_DAYS = 30;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: '인증 필요' }), { status: 401, headers: corsHeaders });

    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: '인증 실패' }), { status: 401, headers: corsHeaders });

    const { data: profile } = await adminClient
      .from('users')
      .select('id, role, district_id, districts(church_id)')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) return new Response(JSON.stringify({ error: '사용자 정보 없음' }), { status: 404, headers: corsHeaders });

    const churchId = (profile.districts as { church_id: string } | null)?.church_id ?? null;

    if (profile.role === 'master' && churchId) {
      // 마스터: 다른 활성 구성원이 있으면 탈퇴 차단
      const { count } = await adminClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .neq('id', user.id)
        .in('district_id', adminClient
          .from('districts')
          .select('id')
          .eq('church_id', churchId)
        );

      if ((count ?? 0) > 0) {
        return new Response(
          JSON.stringify({
            error: 'master_has_members',
            message: '구성원이 있습니다. 먼저 모든 구성원을 탈퇴 처리하거나 권한을 이전한 후 탈퇴해주세요.',
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      // 소프트 딜리트: churches.deleted_at 설정 (30일 유예)
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + SOFT_DELETE_GRACE_DAYS);

      await adminClient
        .from('churches')
        .update({ deleted_at: deletionDate.toISOString() })
        .eq('id', churchId);

      // 마스터 본인 auth 계정 삭제 (앱 접근 불가)
      await adminClient.auth.admin.deleteUser(user.id);
      await adminClient.from('users').delete().eq('id', user.id);

      return new Response(
        JSON.stringify({
          success: true,
          pending_deletion: true,
          deletion_date: deletionDate.toISOString(),
          message: `교회 데이터는 ${SOFT_DELETE_GRACE_DAYS}일 후 영구 삭제됩니다. 복구가 필요하면 고객지원으로 문의해주세요.`,
        }),
        { headers: corsHeaders }
      );

    } else {
      // 구역원/구역장: 본인 데이터만 즉시 삭제
      await adminClient.from('users').delete().eq('id', user.id);
      await adminClient.auth.admin.deleteUser(user.id);

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
