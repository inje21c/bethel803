// 테넌트(교회) 격리 전수 검증 — anon 키로 각 계정 로그인 후 타 교회 데이터 접근 시도
//
// 전제: seed_tenant_fixtures.mjs 로 교회 A/B 픽스처가 시드돼 있어야 함.
//
// 사용법:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/test_tenant_isolation.mjs
//
// 판정:
//  - 교회 A 계정으로 교회 B의 행이 한 건이라도 보이면 FAIL (테넌트 누수)
//  - 교회 스코프 RPC에 타 교회 district_id를 넘겨 데이터가 나오면 FAIL
//  - member가 관리자 전용 RPC를 실행해 성공하면 FAIL(역할 경계)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(__dirname, '.tenant-fixtures.json'), 'utf8'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('환경변수 필요: SUPABASE_URL, SUPABASE_ANON_KEY');
  process.exit(1);
}

// 테넌트 스코프 테이블 — 타 교회 행이 보이면 누수.
// 각 테이블에서 '타 교회 소속 식별자'로 필터링해 0행이어야 한다.
// (church_id 직접 보유 / district_id 경유 / user_id 경유로 분류)
const TABLES_BY_CHURCH = ['districts', 'users', 'church_settings', 'churches', 'bible_reading_plans'];
const TABLES_BY_DISTRICT = ['prayer_requests', 'bible_studies', 'qt_contents', 'schedules', 'weekly_reports'];
const TABLES_BY_USER = [
  'qt_responses', 'study_answers', 'bible_reading_logs', 'bible_bookmarks',
  'streaks', 'deep_meditations', 'notification_preferences', 'push_subscriptions',
];

let pass = 0, fail = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) { pass++; process.stdout.write('.'); }
  else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); process.stdout.write('X'); }
}

async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: fx.password });
  if (error) throw new Error(`로그인 실패(${email}): ${error.message}`);
  return client;
}

async function run() {
  const [A, B] = fx.churches;
  const otherUserIds = B.members.map(m => m.id).concat(B.masterId);
  const otherDistrictIds = B.districts.map(d => d.id);

  // 교회 A의 master로 로그인 (가장 권한 큰 역할로 누수 검증 — leak이 있으면 여기서 가장 잘 드러남)
  console.log(`\n[1] 교회 A master로 교회 B 데이터 접근 시도`);
  const aMaster = await signIn(A.masterEmail);

  // 1) church_id 직접 보유 테이블: 교회 B id로 필터 → 0행이어야
  for (const t of TABLES_BY_CHURCH) {
    if (t === 'churches') {
      const { data } = await aMaster.from(t).select('id').eq('id', B.churchId);
      check(`B.${t} 직접조회`, (data?.length ?? 0) === 0, `${data?.length ?? 0}행 노출`);
    } else {
      const { data } = await aMaster.from(t).select('id').eq('church_id', B.churchId);
      check(`B.${t}(church_id)`, (data?.length ?? 0) === 0, `${data?.length ?? 0}행 노출`);
    }
  }
  // 2) district 경유 테이블: 교회 B 구역 id로 필터 → 0행
  for (const t of TABLES_BY_DISTRICT) {
    const { data } = await aMaster.from(t).select('id').in('district_id', otherDistrictIds);
    check(`B.${t}(district_id)`, (data?.length ?? 0) === 0, `${data?.length ?? 0}행 노출`);
  }
  // 3) user 경유 테이블: 교회 B 유저 id로 필터 → 0행
  for (const t of TABLES_BY_USER) {
    const { data } = await aMaster.from(t).select('*').in('user_id', otherUserIds);
    check(`B.${t}(user_id)`, (data?.length ?? 0) === 0, `${data?.length ?? 0}행 노출`);
  }

  // 4) get_my_church_info() — 반드시 자기 교회만
  {
    const { data } = await aMaster.rpc('get_my_church_info');
    const rows = data ?? [];
    check('get_my_church_info=자기교회', rows.length === 1 && rows[0].id === A.churchId,
      JSON.stringify(rows.map(r => r.id)));
  }

  // 5) 교회 스코프 RPC에 타 교회 district_id 주입 → 데이터 누수 없어야
  console.log(`\n[2] 교회 A master가 교회 B 구역 id로 RPC 호출`);
  const bDistrict = otherDistrictIds[0];
  for (const rpc of [
    { fn: 'get_bible_reading_summaries', args: { p_district_id: bDistrict } },
    { fn: 'get_qt_district_summary', args: { p_district_id: bDistrict } },
    { fn: 'compute_weekly_report', args: { p_week_start: '2026-01-05', p_district_id: bDistrict } },
  ]) {
    const { data, error } = await aMaster.rpc(rpc.fn, rpc.args);
    // 거부(error) 또는 빈 결과면 안전. JSON(weekly_report)·배열 모두 처리.
    let leaked = false;
    if (!error && data) {
      if (Array.isArray(data)) leaked = data.length > 0;
      else if (typeof data === 'object') leaked = JSON.stringify(data).includes(bDistrict);
    }
    check(`RPC ${rpc.fn}(B구역)`, !leaked, error ? `거부됨(OK): ${error.code ?? ''}` : '데이터 누수');
  }

  // 6) 역할 경계: 교회 B member로 로그인해 관리자 전용 동작 차단 확인
  console.log(`\n[3] 교회 B member의 권한 상승 차단 확인`);
  const bMember = await signIn(B.members[0].email);
  // member가 자기 교회 타 구역원 답변(study_answers)을 못 보는지 (성경공부 답변 비공개 규칙)
  {
    const otherMemberInB = B.members[1].id;
    const { data } = await bMember.from('study_answers').select('*').eq('user_id', otherMemberInB);
    check('member가 타인 study_answer 차단', (data?.length ?? 0) === 0, `${data?.length ?? 0}행`);
  }
  // member가 role을 master로 자가 변경 시도 → 트리거(enforce_role_change_master_only)가 차단해야
  {
    const { error } = await bMember.from('users')
      .update({ role: 'master' }).eq('id', B.members[0].id);
    check('member 자가 role 상승 차단', !!error, error ? `차단됨(OK)` : '변경 성공(위험)');
  }
  // member가 assign_my_district로 타 교회(A) 구역 배정 시도 → 실패해야
  {
    const { error } = await bMember.rpc('assign_my_district', { p_district_id: A.districts[0].id });
    check('assign_my_district 타교회 차단', !!error, error ? `차단됨(OK)` : '배정 성공(위험)');
  }

  console.log(`\n\n=== 결과: ${pass} PASS / ${fail} FAIL ===`);
  if (fail > 0) {
    console.log('\n실패 항목:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('테넌트 격리 전수 통과.');
}

run().catch((e) => { console.error('\n오류:', e.message); process.exit(1); });
