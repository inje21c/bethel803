// 테넌트 격리 테스트용 픽스처 시드 (service_role 필요)
//
// 교회 2곳을 만들고 각 교회에 master + 구역2 + 구역별 leader + member 2명을 생성한다.
// auth.admin.createUser({ email_confirm: true })로 이메일 검증 없이 즉시 확정 계정 생성.
// 역할/승인은 handle_new_user 트리거 이후 service_role UPDATE로 마무리.
//
// 사용법 (staging 권장 — 격리 로직은 prod와 동일 마이그레이션):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed_tenant_fixtures.mjs
//
// 결과: scripts/.tenant-fixtures.json 에 교회/구역/계정(이메일·비번·id) 기록.
// 정리:  node scripts/seed_tenant_fixtures.mjs --teardown

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, '.tenant-fixtures.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEARDOWN = process.argv.includes('--teardown');
const PURGE = process.argv.includes('--purge'); // 이름 규칙으로 잔여 테스트 교회 전부 삭제

// 시드: service_role(계정 생성) + anon(마스터 로그인해 역할 승격) 둘 다 필요.
// 역할 변경은 enforce_role_change 트리거가 막으므로 마스터 인증 컨텍스트로만 가능.
// teardown은 service_role만 있으면 됨.
const NEEDS_ANON = !TEARDOWN && !PURGE;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || (NEEDS_ANON && !ANON_KEY)) {
  console.error('환경변수 필요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY' + (NEEDS_ANON ? ', SUPABASE_ANON_KEY' : ''));
  process.exit(1);
}

// prod 안전장치: VITE prod URL이면 명시적 --allow-prod 없이는 중단
if (/project-9zxj4|prod/i.test(SUPABASE_URL) && !process.argv.includes('--allow-prod')) {
  console.error('prod로 보이는 URL입니다. 격리 테스트는 staging 권장. 정말 prod면 --allow-prod 추가.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = process.env.SEED_PASSWORD; // 실행 전 환경변수로 주입: SEED_PASSWORD=... node scripts/seed_tenant_fixtures.mjs
if (!PASSWORD) throw new Error('SEED_PASSWORD 환경변수를 설정하세요.');
const RUN = Date.now().toString(36); // 실행마다 고유 슬러그/이메일

// 교회 2곳 × (구역 2개) × 역할 구성
const PLAN = [
  { key: 'A', churchName: `격리테스트교회A_${RUN}`, districts: ['A-1구역', 'A-2구역'] },
  { key: 'B', churchName: `격리테스트교회B_${RUN}`, districts: ['B-1구역', 'B-2구역'] },
];

function email(role, churchKey, n = '') {
  return `iso_${churchKey.toLowerCase()}_${role}${n}_${RUN}@tenant-test.local`;
}

async function createUser(meta, addr) {
  const { data, error } = await admin.auth.admin.createUser({
    email: addr,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) throw new Error(`createUser(${addr}) 실패: ${error.message}`);
  return data.user.id;
}

async function signInClient(addr) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: addr, password: PASSWORD });
  if (error) throw new Error(`로그인 실패(${addr}): ${error.message}`);
  return client;
}

// 역할/승인 변경은 '마스터 인증 컨텍스트'에서만 가능(트리거 enforce_role_change).
// service_role 직접 UPDATE는 auth.uid()=null이라 is_master() false로 차단됨.
async function promote(masterClient, userId, role, churchId, districtId) {
  const patch = { role, status: 'active' };
  if (districtId) patch.district_id = districtId;
  const { error } = await masterClient
    .from('users')
    .update(patch)
    .eq('id', userId)
    .eq('church_id', churchId); // 교회 경계 안에서만 수정 (안전)
  if (error) throw new Error(`promote(${userId}) 실패: ${error.message}`);
}

async function seed() {
  const fixtures = { runId: RUN, password: PASSWORD, churches: [] };

  for (const church of PLAN) {
    console.log(`\n[교회 ${church.key}] ${church.churchName} 생성`);
    // 1) master + church_name → 트리거가 교회 + 1구역 + master(active) 생성
    const masterAddr = email('master', church.key);
    const masterId = await createUser(
      { name: `${church.key} 마스터`, church_name: church.churchName },
      masterAddr,
    );

    // 트리거가 만든 교회/구역 조회
    const { data: masterRow, error: mErr } = await admin
      .from('users').select('church_id, district_id').eq('id', masterId).single();
    if (mErr) throw new Error(`master 조회 실패: ${mErr.message}`);
    const churchId = masterRow.church_id;

    // 마스터로 로그인 → 이후 역할 승격/승인은 이 컨텍스트로 수행
    const masterClient = await signInClient(masterAddr);

    // 2) 추가 구역 생성 (트리거는 1구역만 만듦)
    const { data: existingDistricts } = await admin
      .from('districts').select('id, name').eq('church_id', churchId);
    const districts = [...(existingDistricts ?? [])];
    for (const dName of church.districts.slice(1)) {
      const { data: d, error: dErr } = await admin
        .from('districts').insert({ name: dName, church_id: churchId, is_active: true })
        .select('id, name').single();
      if (dErr) throw new Error(`구역 생성 실패: ${dErr.message}`);
      districts.push(d);
    }

    const churchFx = {
      key: church.key, churchId, masterId, masterEmail: masterAddr,
      districts: [], members: [],
    };

    // 3) 구역별 leader + member 2명
    for (let i = 0; i < districts.length; i++) {
      const d = districts[i];
      // leader: member로 가입 후 leader 승격
      const leaderAddr = email('leader', church.key, i + 1);
      const leaderId = await createUser(
        { name: `${church.key} 구역장${i + 1}`, district_id: d.id }, leaderAddr);
      await promote(masterClient, leaderId, 'leader', churchId, d.id);

      const members = [];
      for (let m = 1; m <= 2; m++) {
        const memAddr = email('member', church.key, `${i + 1}_${m}`);
        const memId = await createUser(
          { name: `${church.key} 구역원${i + 1}-${m}`, district_id: d.id }, memAddr);
        await promote(masterClient, memId, 'member', churchId, d.id);
        members.push({ id: memId, email: memAddr, districtId: d.id });
      }

      churchFx.districts.push({ id: d.id, name: d.name, leaderId, leaderEmail: leaderAddr });
      churchFx.members.push(...members);
    }

    fixtures.churches.push(churchFx);
    console.log(`  교회 ${church.key} 완료: 구역 ${churchFx.districts.length}, 계정 ${2 + churchFx.districts.length * 3}개`);
  }

  writeFileSync(FIXTURE_PATH, JSON.stringify(fixtures, null, 2));
  console.log(`\n시드 완료 → ${FIXTURE_PATH}`);
  console.log('다음: node scripts/test_tenant_isolation.mjs');
}

async function teardown() {
  if (!existsSync(FIXTURE_PATH)) {
    console.error('픽스처 파일 없음. 정리할 대상이 없습니다.');
    process.exit(1);
  }
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  for (const c of fx.churches) {
    const userIds = [c.masterId, ...c.districts.map(d => d.leaderId), ...c.members.map(m => m.id)];
    for (const uid of userIds) {
      await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
    // 교회 행 삭제 (FK cascade로 districts/qt_contents 등 정리 — 스키마 cascade 가정)
    await admin.from('churches').delete().eq('id', c.churchId);
    console.log(`교회 ${c.key} 및 계정 ${userIds.length}개 삭제`);
  }
  console.log('정리 완료. 픽스처 파일은 수동 삭제하세요.');
}

// 이름 규칙으로 잔여 테스트 교회/계정을 전부 삭제 (실패한 부분 시드 청소용)
async function purge() {
  const { data: churches, error } = await admin
    .from('churches').select('id, name').like('name', '격리테스트교회%');
  if (error) throw new Error(`교회 조회 실패: ${error.message}`);
  if (!churches || churches.length === 0) {
    console.log('삭제할 테스트 교회가 없습니다.');
    return;
  }
  for (const c of churches) {
    const { data: members } = await admin.from('users').select('id').eq('church_id', c.id);
    for (const u of members ?? []) {
      await admin.auth.admin.deleteUser(u.id).catch(() => {});
    }
    await admin.from('churches').delete().eq('id', c.id);
    console.log(`삭제: ${c.name} (계정 ${members?.length ?? 0}개)`);
  }
  console.log('잔여 테스트 교회 청소 완료.');
}

const action = PURGE ? purge() : TEARDOWN ? teardown() : seed();
action.catch((e) => {
  console.error('\n오류:', e.message);
  process.exit(1);
});
