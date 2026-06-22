// 커뮤니티 컨테이너 멀티-리더 격리 검증
// 한 커뮤니티 교회(00000000-0000-4100-a000-000000000002) 밑에서
// 리더 A가 리더 B의 구역/구성원/콘텐츠를 못 봐야 한다.
//
// 사용법:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/test_community_isolation.mjs
//
// 임시 계정/구역을 만들고 끝나면 정리(teardown)한다.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SR) {
  console.error('환경변수 필요: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (/project-9zxj4/i.test(URL) && !process.argv.includes('--allow-prod')) {
  console.error('prod URL 감지 — --allow-prod 없이는 중단');
  process.exit(1);
}

const COMMUNITY = '00000000-0000-4100-a000-000000000002';
const PW = 'Test1234!';
const admin = createClient(URL, SR, { auth: { persistSession: false } });

let pass = 0, fail = 0; const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; process.stdout.write('.'); }
  else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); process.stdout.write('X'); }
}

const created = [];
async function 테스터A(label, group) {
  const email = `iso.comm.${label}.${Date.now().toString(36)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PW, email_confirm: true,
    user_metadata: { name: group + '장', group_name: group },
  });
  if (error) throw error;
  created.push(data.user.id);
  return { id: data.user.id, email };
}

async function run() {
  const tag = Date.now().toString(36);
  const A = await 테스터A('a', `격리A모임_${tag}`);
  const B = await 테스터A('b', `격리B모임_${tag}`);
  await new Promise(r => setTimeout(r, 800)); // 트리거 반영

  const { data: rows } = await admin.from('users').select('id,role,district_id,church_id').in('id', [A.id, B.id]);
  const uA = rows.find(r => r.id === A.id), uB = rows.find(r => r.id === B.id);

  check('A는 커뮤니티 컨테이너 소속', uA.church_id === COMMUNITY);
  check('B는 커뮤니티 컨테이너 소속', uB.church_id === COMMUNITY);
  check('A는 leader', uA.role === 'leader');
  check('B는 leader', uB.role === 'leader');

  const a = createClient(URL, ANON, { auth: { persistSession: false } });
  const si = await a.auth.signInWithPassword({ email: A.email, password: PW });
  check('A 로그인 성공', !si.error, si.error?.message);

  // 정상성: 자기 구역은 보여야 함
  const { data: ownD } = await a.from('districts').select('id').eq('id', uA.district_id);
  check('A가 자기 구역 조회 가능', !!(ownD && ownD.length));

  // 격리: B의 구역 row를 못 봐야 함
  const { data: dB } = await a.from('districts').select('id,name').eq('id', uB.district_id);
  check('A가 B 구역 row 안보임(구역명 격리)', !(dB && dB.length), dB && dB.length ? `보임: ${dB[0].name}` : '');

  // 격리: B의 구성원(users)을 못 봐야 함
  const { data: uBusers } = await a.from('users').select('id').eq('district_id', uB.district_id);
  check('A가 B 구성원 안보임', !(uBusers && uBusers.length), uBusers && uBusers.length ? `${uBusers.length}명` : '');

  // 격리: district_id 컬럼을 가진 district-scoped 테이블에서 B 구역 데이터 0행
  // (prayer_requests는 user_id 스코프 → 표준 테스트가 커버)
  for (const tbl of ['bible_studies', 'schedules', 'weekly_reports']) {
    const { data: d, error } = await a.from(tbl).select('id').eq('district_id', uB.district_id);
    check(`A가 B ${tbl} 안보임`, !error && !(d && d.length), error ? error.message : (d && d.length ? `${d.length}행` : ''));
  }

  // teardown
  for (const id of created) await admin.auth.admin.deleteUser(id);
  await admin.from('districts').delete().in('id', [uA.district_id, uB.district_id]);
}

run().then(() => {
  console.log(`\n\n=== 결과: ${pass} PASS / ${fail} FAIL ===`);
  if (fail) { console.log('실패 항목:'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('커뮤니티 멀티-리더 격리 통과.');
}).catch(async (e) => {
  console.error('\n오류:', e.message);
  for (const id of created) { try { await admin.auth.admin.deleteUser(id); } catch {} }
  process.exit(1);
});
