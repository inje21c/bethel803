import { supabase, type Database } from './supabase';
import { startTrace } from './utils';

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

const API_TIMEOUT_MS = 10000;

function withApiTimeout<T>(promise: Promise<T>, label: string, ms = API_TIMEOUT_MS): Promise<T> {
  const trace = startTrace('API', label, { timeoutMs: ms });
  const watchedPromise = promise
    .then((result) => {
      trace.success();
      return result;
    })
    .catch((error) => {
      trace.error(error);
      throw error;
    });

  return withTimeout(
    watchedPromise,
    ms,
    `${label} 요청이 지연되고 있습니다. 잠시 후 다시 시도해주세요.`
  ).catch((error) => {
    trace.error(error, { timedOut: true });
    throw error;
  });
}

export function getKSTDateString(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// ============================================================
// 타입 정의
// ============================================================

export interface BibleStudy {
  id: string;
  weekNumber: number;
  date: string;
  title: string;
  scripture: string;
  introduction: string;
  questions: string[];
  published: boolean;
  sourceId?: string | null;
  sourcePdfUrl?: string | null;
  sourceSnapshot?: Record<string, unknown>;
}

export interface StudySource {
  id: string;
  weekNumber: number;
  date: string;
  title: string;
  scripture: string;
  introduction: string;
  questions: string[];
  sourcePdfUrl: string | null;
  parseMode: 'auto' | 'manual';
  parsedBy: string | null;
  createdAt: string;
}

export interface StudyAnswer {
  id: string;
  studyId: string;
  userId: string;
  answers: Record<number, string>;
  completed: boolean;
  updatedAt: string;
}

export interface PrayerRequest {
  id: string;
  userId: string;
  userName: string;
  content: string;
  response: string;
  answered: boolean;
  sharedWithLeader: boolean;
  sharedWithGroup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrayerResponse {
  id: string;
  prayerRequestId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface PrayerIntercession {
  id: string;
  prayerRequestId: string;
  userId: string;
  createdAt: string;
}

export interface BibleReadingLog {
  id: string;
  userId: string;
  date: string;
  chapters: number;
  sourceType: 'manual' | 'plan';
  sourceLabel: string;
  planId: string | null;
  planDayId: string | null;
}

export interface BibleBook {
  id: number;
  koreanName: string;
  abbreviation: string;
  testament: 'old' | 'new';
  order: number;
  chapterCount: number;
}

export interface BibleVerse {
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleBookmark {
  id: string;
  userId: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  note: string;
  createdAt: string;
}

export type BibleReadingPlanScope = 'all' | 'old' | 'new';

export interface BibleReadingPlanItem {
  id: string;
  planDayId: string;
  planId: string;
  sequence: number;
  bookId: number;
  bookName: string;
  chapter: number;
  completedAt: string | null;
}

export interface BibleReadingPlanDay {
  id: string;
  planId: string;
  dayNumber: number;
  scheduledDate: string;
  chapterCount: number;
  completedAt: string | null;
  items: BibleReadingPlanItem[];
}

export interface BibleReadingPlan {
  id: string;
  userId: string;
  title: string;
  translation: string;
  scope: BibleReadingPlanScope | 'custom';
  startDate: string;
  endDate: string;
  dailyChapterTarget: number | null;
  totalChapters: number;
  isPrimary: boolean;
  status: 'active' | 'completed' | 'archived';
  days: BibleReadingPlanDay[];
}

export interface BiblePlanChapterCompletionResult {
  planId: string;
  planTitle: string;
  planDayId: string;
  itemId: string;
  alreadyCompleted: boolean;
}

interface BiblePlanChapterRef {
  bookId: number;
  chapter: number;
}

export interface Schedule {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  memo: string;
  attachment: string;
  attendanceCheck: boolean;
  createdBy: string;
  createdAt: string;
}

interface ListOptions {
  limit?: number;
}

export interface Attendance {
  scheduleId: string;
  userId: string;
  userName: string;
  status: 'attending' | 'absent' | 'pending';
  updatedAt: string;
}

export interface FullUser {
  id: string;
  name: string;
  role: 'master' | 'leader' | 'member';
  status: 'pending' | 'active';
  createdAt: string;
  districtId: string;
  districtName: string;
}

// ============================================================
// 구역 관리
// ============================================================

export interface District {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export async function getDistricts(): Promise<District[]> {
  const { data, error } = await withApiTimeout(
    supabase.from('districts').select('*').order('created_at', { ascending: true }),
    '구역 목록 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    isActive: row.is_active,
  }));
}

export async function getActiveDistricts(): Promise<{ id: string; name: string; churchName: string }[]> {
  const { data, error } = await withApiTimeout(
    supabase.rpc('get_active_districts_with_church'),
    '활성 구역 조회'
  );
  if (error) throw error;
  return (data ?? []).map((row: { id: string; name: string; church_name: string }) => ({
    id: row.id,
    name: row.name,
    churchName: row.church_name,
  }));
}

export async function createDistrict(params: { name: string; description: string }): Promise<void> {
  const { data: churchId, error: churchErr } = await supabase.rpc('get_my_church_id');
  if (churchErr || !churchId) throw new Error('교회 정보를 불러올 수 없습니다.');
  const { error } = await withApiTimeout(
    supabase.from('districts').insert({
      name: params.name,
      description: params.description || null,
      church_id: churchId,
    }),
    '구역 생성'
  );
  if (error) throw error;
}

export async function updateDistrict(params: { id: string; name: string; description: string }): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('districts').update({
      name: params.name,
      description: params.description || null,
    }).eq('id', params.id),
    '구역 수정'
  );
  if (error) throw error;
}

export async function deactivateDistrict(id: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('districts').update({ is_active: false }).eq('id', id),
    '구역 비활성화'
  );
  if (error) throw error;
}

export async function changeUserDistrict(userId: string, districtId: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('users').update({ district_id: districtId }).eq('id', userId),
    '소속 구역 변경'
  );
  if (error) throw error;
}

// ============================================================
// 성경공부
// ============================================================

export async function getBibleStudies(districtId: string, options: ListOptions = {}): Promise<BibleStudy[]> {
  let query = supabase
    .from('bible_studies')
    .select('*')
    .eq('published', true)
    .eq('district_id', districtId)
    .order('study_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  const { data, error } = await withApiTimeout(
    query,
    '성경공부 목록 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    weekNumber: row.week_number,
    date: row.study_date,
    title: row.title,
    scripture: row.scripture,
    introduction: row.introduction,
    questions: row.questions as string[],
    published: row.published,
    sourceId: row.source_id ?? null,
    sourcePdfUrl: row.source_pdf_url ?? null,
    sourceSnapshot: (row.source_snapshot as Record<string, unknown> | null | undefined) ?? {},
  }));
}

export async function getAllBibleStudies(districtId: string): Promise<BibleStudy[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_studies')
      .select('*')
      .eq('district_id', districtId)
      .order('study_date', { ascending: false }),
    '전체 성경공부 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    weekNumber: row.week_number,
    date: row.study_date,
    title: row.title,
    scripture: row.scripture,
    introduction: row.introduction,
    questions: row.questions as string[],
    published: row.published,
    sourceId: row.source_id ?? null,
    sourcePdfUrl: row.source_pdf_url ?? null,
    sourceSnapshot: (row.source_snapshot as Record<string, unknown> | null | undefined) ?? {},
  }));
}

export async function getStudySources(): Promise<StudySource[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('study_sources')
      .select('*')
      .order('study_date', { ascending: false })
      .order('created_at', { ascending: false }),
    '성경공부 원본 조회'
  );
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    weekNumber: row.week_number,
    date: row.study_date,
    title: row.title,
    scripture: row.scripture ?? '',
    introduction: row.introduction ?? '',
    questions: Array.isArray(row.questions) ? (row.questions as string[]) : [],
    sourcePdfUrl: row.source_pdf_url ?? null,
    parseMode: row.parse_mode,
    parsedBy: row.parsed_by ?? null,
    createdAt: row.created_at,
  }));
}

export async function createDistrictStudyFromSource(sourceId: string, districtId?: string): Promise<string> {
  const { data, error } = await withApiTimeout(
    supabase.rpc('create_bible_study_from_source', {
      p_source_id: sourceId,
      p_district_id: districtId ?? null,
    }),
    '원본 기반 수정본 생성',
    30000
  );
  if (error) throw error;
  if (!data) throw new Error('수정본 생성 결과를 받지 못했습니다.');
  return data as string;
}

export async function createBibleStudy(params: {
  weekNumber: number;
  date: string;
  title: string;
  scripture: string;
  introduction: string;
  questions: string[];
  published: boolean;
  districtId: string;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('bible_studies').insert({
      week_number: params.weekNumber,
      study_date: params.date,
      title: params.title,
      scripture: params.scripture,
      introduction: params.introduction,
      questions: params.questions,
      published: params.published,
      district_id: params.districtId,
    }),
    '성경공부 등록'
  );
  if (error) throw error;
}

export async function updateBibleStudy(params: {
  id: string;
  weekNumber: number;
  date: string;
  title: string;
  scripture: string;
  introduction: string;
  questions: string[];
  published: boolean;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('bible_studies')
      .update({
        week_number: params.weekNumber,
        study_date: params.date,
        title: params.title,
        scripture: params.scripture,
        introduction: params.introduction,
        questions: params.questions,
        published: params.published,
      })
      .eq('id', params.id),
    '성경공부 수정'
  );
  if (error) throw error;
}

export async function deleteBibleStudy(id: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('bible_studies').delete().eq('id', id),
    '성경공부 삭제'
  );
  if (error) throw error;
}

export async function getStudyAnswer(studyId: string, userId: string): Promise<StudyAnswer | null> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('study_answers')
      .select('*')
      .eq('study_id', studyId)
      .eq('user_id', userId)
      .maybeSingle(),
    '성경공부 답안 조회'
  );
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    studyId: data.study_id,
    userId: data.user_id,
    answers: data.answers as Record<number, string>,
    completed: data.completed,
    updatedAt: data.updated_at,
  };
}

export async function saveStudyAnswer(params: {
  studyId: string;
  userId: string;
  userName: string;
  answers: Record<number, string>;
  completed: boolean;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('study_answers')
      .upsert(
        {
          study_id: params.studyId,
          user_id: params.userId,
          answers: params.answers,
          completed: params.completed,
        },
        { onConflict: 'study_id,user_id' }
      ),
    '성경공부 답안 저장'
  );
  if (error) throw error;
}

export interface StudyAnswerWithUser {
  id: string;
  userId: string;
  userName: string;
  answers: Record<number, string>;
  completed: boolean;
  updatedAt: string;
}

/** 리더용: 특정 성경공부의 모든 구역원 답변 조회 */
export async function getStudyAnswersForStudy(studyId: string, districtId: string): Promise<StudyAnswerWithUser[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('study_answers')
      .select('id, user_id, answers, completed, updated_at, users!inner(name, district_id)')
      .eq('study_id', studyId)
      .eq('users.district_id', districtId)
      .order('updated_at', { ascending: false }),
    '성경공부 답변 전체 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    userId: row.user_id,
    userName: (row.users as { name: string } | null)?.name ?? '알 수 없음',
    answers: row.answers as Record<number, string>,
    completed: row.completed,
    updatedAt: row.updated_at,
  }));
}

/** 구역원용: 본인의 전체 성경공부 완료 현황 (studyId → completed) */
export async function getMyStudyCompletions(userId: string): Promise<Record<string, boolean>> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('study_answers')
      .select('study_id, completed')
      .eq('user_id', userId),
    '성경공부 완료 현황 조회'
  );
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(row => [row.study_id as string, row.completed as boolean]));
}

// ============================================================
// 기도제목
// ============================================================

function mapPrayerRow(row: Record<string, unknown>): PrayerRequest {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userName: (row.users as { name: string } | null)?.name ?? '알 수 없음',
    content: row.content as string,
    response: (row.response as string) ?? '',
    answered: row.answered as boolean,
    sharedWithLeader: (row.shared_with_leader as boolean) ?? false,
    sharedWithGroup: (row.shared_with_group as boolean) ?? false,
    createdAt: (row.created_at as string).slice(0, 10),
    updatedAt: (row.updated_at as string).slice(0, 10),
  };
}

export async function getPrayerRequests(districtId: string, options: ListOptions = {}): Promise<PrayerRequest[]> {
  let query = supabase
    .from('prayer_requests')
    .select('*, users!inner(name, district_id)')
    .eq('users.district_id', districtId)
    .order('created_at', { ascending: false });

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  const { data, error } = await withApiTimeout(
    query,
    '기도제목 조회'
  );
  if (error) throw error;
  return (data ?? []).map(mapPrayerRow);
}

export async function getUnansweredPrayerCount(districtId: string): Promise<number> {
  const { count, error } = await withApiTimeout(
    supabase
      .from('prayer_requests')
      .select('id, users!inner(id)', { count: 'exact', head: true })
      .eq('answered', false)
      .eq('users.district_id', districtId),
    '미응답 기도제목 수 조회'
  );
  if (error) throw error;
  return count ?? 0;
}

export async function getActiveMemberCount(districtId: string): Promise<number> {
  const { count, error } = await withApiTimeout(
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('district_id', districtId)
      .eq('status', 'active'),
    '활성 구역원 수 조회'
  );
  if (error) throw error;
  return count ?? 0;
}

export async function getTodayActiveCount(districtId: string): Promise<{ today: number; total: number }> {
  const todayStart = `${getKSTDateString(new Date())}T00:00:00+09:00`;
  const [totalResult, todayResult] = await Promise.all([
    withApiTimeout(
      supabase.from('users').select('id', { count: 'exact', head: true })
        .eq('district_id', districtId).eq('status', 'active'),
      '구역원 전체 수'
    ),
    withApiTimeout(
      supabase.from('users').select('id', { count: 'exact', head: true })
        .eq('district_id', districtId).eq('status', 'active')
        .gte('last_login_at', todayStart),
      '오늘 활성 구역원 수'
    ),
  ]);
  if (totalResult.error) throw totalResult.error;
  if (todayResult.error) throw todayResult.error;
  return { today: todayResult.count ?? 0, total: totalResult.count ?? 0 };
}

export async function getPrayerRequest(id: string): Promise<PrayerRequest | null> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('prayer_requests')
      .select('*, users(name)')
      .eq('id', id)
      .maybeSingle(),
    '기도제목 상세 조회'
  );
  if (error) throw error;
  if (!data) return null;
  return mapPrayerRow(data);
}

export async function savePrayerRequest(params: {
  userId: string;
  content: string;
  sharedWithLeader?: boolean;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('prayer_requests').insert({
      user_id: params.userId,
      content: params.content,
      shared_with_leader: params.sharedWithLeader ?? false,
    }),
    '기도제목 등록'
  );
  if (error) throw error;
}

export async function updatePrayerRequest(params: {
  id: string;
  content?: string;
  response?: string;
  answered?: boolean;
  sharedWithLeader?: boolean;
  sharedWithGroup?: boolean;
}): Promise<void> {
  const update: Record<string, unknown> = {};
  if (params.content !== undefined) update.content = params.content;
  if (params.response !== undefined) update.response = params.response;
  if (params.answered !== undefined) update.answered = params.answered;
  if (params.sharedWithLeader !== undefined) update.shared_with_leader = params.sharedWithLeader;
  if (params.sharedWithGroup !== undefined) update.shared_with_group = params.sharedWithGroup;
  const { error } = await withApiTimeout(
    supabase.from('prayer_requests').update(update).eq('id', params.id),
    '기도제목 수정'
  );
  if (error) throw error;
}

export async function deletePrayerRequest(id: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('prayer_requests').delete().eq('id', id),
    '기도제목 삭제'
  );
  if (error) throw error;
}

export async function getSharedPrayerRequests(districtId: string): Promise<PrayerRequest[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('prayer_requests')
      .select('*, users!inner(name, district_id)')
      .eq('shared_with_leader', true)
      .eq('users.district_id', districtId)
      .order('created_at', { ascending: false }),
    '공유된 기도제목 조회'
  );
  if (error) throw error;
  return (data ?? []).map(mapPrayerRow);
}

export async function getGroupPrayerRequests(districtId: string, options: ListOptions = {}): Promise<PrayerRequest[]> {
  let query = supabase
    .from('prayer_requests')
    .select('*, users!inner(name, district_id)')
    .eq('shared_with_group', true)
    .eq('users.district_id', districtId)
    .order('created_at', { ascending: false });

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  const { data, error } = await withApiTimeout(
    query,
    '중보기도 목록 조회'
  );
  if (error) throw error;
  return (data ?? []).map(mapPrayerRow);
}

export async function getPrayerResponses(prayerRequestId: string): Promise<PrayerResponse[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('prayer_responses')
      .select('*, users(name)')
      .eq('prayer_request_id', prayerRequestId)
      .order('created_at', { ascending: true }),
    '기도 응답 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    prayerRequestId: row.prayer_request_id,
    userId: row.user_id,
    userName: (row.users as { name: string } | null)?.name ?? '알 수 없음',
    content: row.content,
    createdAt: row.created_at.slice(0, 10),
  }));
}

export async function addPrayerResponse(params: {
  prayerRequestId: string;
  userId: string;
  content: string;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('prayer_responses').insert({
      prayer_request_id: params.prayerRequestId,
      user_id: params.userId,
      content: params.content,
    }),
    '기도 응답 추가'
  );
  if (error) throw error;
}

export async function deletePrayerResponse(id: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('prayer_responses').delete().eq('id', id),
    '기도 응답 삭제'
  );
  if (error) throw error;
}

// ============================================================
// 중보기도 참여 (함께 기도합니다)
// ============================================================

/** 함께 기도 토글 — 있으면 DELETE, 없으면 INSERT */
export async function toggleIntercession(prayerRequestId: string, userId: string): Promise<boolean> {
  // 기존 참여 여부 확인
  const { data: existing } = await withApiTimeout(
    supabase
      .from('prayer_intercessions')
      .select('id')
      .eq('prayer_request_id', prayerRequestId)
      .eq('user_id', userId)
      .maybeSingle(),
    '중보기도 참여 확인'
  );

  if (existing) {
    const { error } = await withApiTimeout(
      supabase.from('prayer_intercessions').delete().eq('id', existing.id),
      '중보기도 참여 해제'
    );
    if (error) throw error;
    return false; // 해제됨
  } else {
    const { error } = await withApiTimeout(
      supabase.from('prayer_intercessions').insert({
        prayer_request_id: prayerRequestId,
        user_id: userId,
      }),
      '중보기도 참여 등록'
    );
    if (error) throw error;
    return true; // 참여됨
  }
}

/** 내가 체크한 중보기도 목록 (prayer_request_id Set 반환) */
export async function getMyIntercessions(userId: string): Promise<Set<string>> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('prayer_intercessions')
      .select('prayer_request_id')
      .eq('user_id', userId),
    '내 중보기도 참여 조회'
  );
  if (error) throw error;
  return new Set((data ?? []).map(row => row.prayer_request_id as string));
}

/** 각 기도제목별 참여자 수 */
export async function getIntercessionCounts(prayerRequestIds: string[]): Promise<Record<string, number>> {
  if (prayerRequestIds.length === 0) return {};
  const { data, error } = await withApiTimeout(
    supabase
      .from('prayer_intercessions')
      .select('prayer_request_id')
      .in('prayer_request_id', prayerRequestIds),
    '중보기도 참여자 수 조회'
  );
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.prayer_request_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** 특정 기도제목 참여자 목록 */
export async function getIntercessionUsers(prayerRequestId: string): Promise<{ userId: string; userName: string }[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('prayer_intercessions')
      .select('user_id, users(name)')
      .eq('prayer_request_id', prayerRequestId)
      .order('created_at', { ascending: true }),
    '중보기도 참여자 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    userId: row.user_id as string,
    userName: (row.users as { name: string } | null)?.name ?? '알 수 없음',
  }));
}

// ============================================================
// 성경읽기
// ============================================================

export async function getBibleBooks(): Promise<BibleBook[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_books')
      .select('*')
      .order('book_order', { ascending: true }),
    '성경 권 목록 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    koreanName: row.korean_name,
    abbreviation: row.abbreviation ?? row.korean_name,
    testament: row.testament,
    order: row.book_order,
    chapterCount: row.chapter_count,
  }));
}

export async function getBibleChapter(bookId: number, chapter: number): Promise<BibleVerse[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_verses')
      .select('*')
      .eq('book_id', bookId)
      .eq('chapter', chapter)
      .order('verse', { ascending: true }),
    '성경 본문 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    bookId: row.book_id,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
  }));
}

export async function getBibleBookmarks(userId: string): Promise<BibleBookmark[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    '성경 북마크 조회'
  );
  if (error) throw error;
  const bookmarks = data ?? [];
  const bookIds = [...new Set(bookmarks.map(row => row.book_id))];
  const { data: books, error: booksError } = bookIds.length > 0
    ? await withApiTimeout(
      supabase
        .from('bible_books')
        .select('id, korean_name')
        .in('id', bookIds),
      '북마크 성경 권 조회'
    )
    : { data: [], error: null };
  if (booksError) throw booksError;

  const bookNameMap = new Map((books ?? []).map(book => [book.id, book.korean_name]));
  const texts = await Promise.all(
    bookmarks.map(async row => {
      const { data: verse } = await supabase
        .from('bible_verses')
        .select('text')
        .eq('book_id', row.book_id)
        .eq('chapter', row.chapter)
        .eq('verse', row.verse)
        .maybeSingle();
      return verse?.text ?? '';
    })
  );

  return bookmarks.map((row, index) => ({
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    bookName: bookNameMap.get(row.book_id) ?? '',
    chapter: row.chapter,
    verse: row.verse,
    text: texts[index],
    note: row.note ?? '',
    createdAt: row.created_at,
  }));
}

export async function addBibleBookmark(params: {
  userId: string;
  bookId: number;
  chapter: number;
  verse: number;
  note?: string;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('bible_bookmarks')
      .upsert(
        {
          user_id: params.userId,
          book_id: params.bookId,
          chapter: params.chapter,
          verse: params.verse,
          note: params.note ?? '',
        },
        { onConflict: 'user_id,book_id,chapter,verse' }
      ),
    '성경 북마크 저장'
  );
  if (error) throw error;
}

export async function deleteBibleBookmark(id: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('bible_bookmarks').delete().eq('id', id),
    '성경 북마크 삭제'
  );
  if (error) throw error;
}

function addDaysToDateString(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/**
 * 읽기표 장 항목 전체 조회.
 * PostgREST는 쿼리당 최대 1,000행만 반환하므로(성경 전체 플랜은 1,189장)
 * range 페이지네이션으로 전부 가져온다. (1,000행 절단 시 334일차부터 데이터 누락)
 */
async function fetchAllPlanItems(
  planId: string,
  label: string
): Promise<Database['public']['Tables']['bible_reading_plan_day_items']['Row'][]> {
  const pageSize = 1000;
  const rows: Database['public']['Tables']['bible_reading_plan_day_items']['Row'][] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await withApiTimeout(
      supabase
        .from('bible_reading_plan_day_items')
        .select('*')
        .eq('plan_id', planId)
        .order('sequence', { ascending: true })
        .range(from, from + pageSize - 1),
      label
    );
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function buildBiblePlanChapters(books: BibleBook[], scope: BibleReadingPlanScope): BiblePlanChapterRef[] {
  const selectedBooks = books.filter(book => {
    if (scope === 'old') return book.testament === 'old';
    if (scope === 'new') return book.testament === 'new';
    return true;
  });

  return selectedBooks.flatMap(book =>
    Array.from({ length: book.chapterCount }, (_, index) => ({
      bookId: book.id,
      chapter: index + 1,
    }))
  );
}

function buildChapterKey(bookId: number, chapter: number) {
  return `${bookId}:${chapter}`;
}

function mapPlan(
  plan: Database['public']['Tables']['bible_reading_plans']['Row'],
  days: Database['public']['Tables']['bible_reading_plan_days']['Row'][],
  items: Database['public']['Tables']['bible_reading_plan_day_items']['Row'][],
  books: BibleBook[]
): BibleReadingPlan {
  const bookNameMap = new Map(books.map(book => [book.id, book.koreanName]));
  const itemsByDay = new Map<string, BibleReadingPlanItem[]>();

  items.forEach(item => {
    const mapped: BibleReadingPlanItem = {
      id: item.id,
      planDayId: item.plan_day_id,
      planId: item.plan_id,
      sequence: item.sequence,
      bookId: item.book_id,
      bookName: bookNameMap.get(item.book_id) ?? '',
      chapter: item.chapter,
      completedAt: item.completed_at,
    };
    const current = itemsByDay.get(item.plan_day_id) ?? [];
    current.push(mapped);
    itemsByDay.set(item.plan_day_id, current);
  });

  return {
    id: plan.id,
    userId: plan.owner_user_id,
    title: plan.title,
    translation: plan.translation,
    scope: plan.scope,
    startDate: plan.start_date,
    endDate: plan.end_date,
    dailyChapterTarget: plan.daily_chapter_target,
    totalChapters: plan.total_chapters,
    isPrimary: plan.is_primary,
    status: plan.status,
    days: days.map(day => ({
      id: day.id,
      planId: day.plan_id,
      dayNumber: day.day_number,
      scheduledDate: day.scheduled_date,
      chapterCount: day.chapter_count,
      completedAt: day.completed_at,
      items: itemsByDay.get(day.id) ?? [],
    })),
  };
}

export async function getPrimaryBibleReadingPlan(userId: string): Promise<BibleReadingPlan | null> {
  const { data: plan, error: planError } = await withApiTimeout(
    supabase
      .from('bible_reading_plans')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('status', 'active')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    '대표 읽기표 조회'
  );
  if (planError) throw planError;
  if (!plan) return null;

  const [{ data: days, error: daysError }, items, books] = await Promise.all([
    withApiTimeout(
      supabase
        .from('bible_reading_plan_days')
        .select('*')
        .eq('plan_id', plan.id)
        .order('day_number', { ascending: true }),
      '읽기표 날짜 조회'
    ),
    fetchAllPlanItems(plan.id, '읽기표 장 목록 조회'),
    getBibleBooks(),
  ]);
  if (daysError) throw daysError;

  return mapPlan(plan, days ?? [], items, books);
}

export async function createBibleReadingPlan(params: {
  userId: string;
  title: string;
  scope: BibleReadingPlanScope;
  startDate: string;
  dailyChapterTarget: number;
}): Promise<BibleReadingPlan> {
  const books = await getBibleBooks();
  const chapters = buildBiblePlanChapters(books, params.scope);
  if (chapters.length === 0) {
    throw new Error('읽기표를 만들 성경 범위가 없습니다.');
  }

  const dayChunks = chunkRows(chapters, params.dailyChapterTarget);
  const endDate = addDaysToDateString(params.startDate, dayChunks.length - 1);

  const { error: primaryError } = await withApiTimeout(
    supabase
      .from('bible_reading_plans')
      .update({ is_primary: false })
      .eq('owner_user_id', params.userId)
      .eq('is_primary', true),
    '기존 대표 읽기표 해제'
  );
  if (primaryError) throw primaryError;

  const { data: plan, error: planError } = await withApiTimeout(
    supabase
      .from('bible_reading_plans')
      .insert({
        owner_user_id: params.userId,
        title: params.title.trim() || '말씀을 읽는 기쁨',
        scope: params.scope,
        start_date: params.startDate,
        end_date: endDate,
        daily_chapter_target: params.dailyChapterTarget,
        total_chapters: chapters.length,
        is_primary: true,
      })
      .select('*')
      .single(),
    '읽기표 생성'
  );
  if (planError) throw planError;

  const dayRows = dayChunks.map((chunk, index) => ({
    plan_id: plan.id,
    day_number: index + 1,
    scheduled_date: addDaysToDateString(params.startDate, index),
    chapter_count: chunk.length,
  }));
  const { data: insertedDays, error: daysError } = await withApiTimeout(
    supabase
      .from('bible_reading_plan_days')
      .insert(dayRows)
      .select('*'),
    '읽기표 날짜 생성'
  );
  if (daysError) throw daysError;

  const dayIdMap = new Map((insertedDays ?? []).map(day => [day.day_number, day.id]));
  const itemRows = dayChunks.flatMap((chunk, dayIndex) => {
    const dayNumber = dayIndex + 1;
    const planDayId = dayIdMap.get(dayNumber);
    if (!planDayId) return [];
    return chunk.map((chapter, chapterIndex) => ({
      plan_id: plan.id,
      plan_day_id: planDayId,
      sequence: dayIndex * params.dailyChapterTarget + chapterIndex + 1,
      book_id: chapter.bookId,
      chapter: chapter.chapter,
    }));
  });

  for (const batch of chunkRows(itemRows, 500)) {
    const { error } = await withApiTimeout(
      supabase.from('bible_reading_plan_day_items').insert(batch),
      '읽기표 장 목록 생성'
    );
    if (error) throw error;
  }

  const created = await getPrimaryBibleReadingPlan(params.userId);
  if (!created) throw new Error('생성된 읽기표를 불러오지 못했습니다.');
  return created;
}

export async function updateBibleReadingPlan(params: {
  planId: string;
  userId: string;
  title: string;
  scope: BibleReadingPlanScope;
  startDate: string;
  dailyChapterTarget: number;
}): Promise<BibleReadingPlan> {
  if (!params.dailyChapterTarget || params.dailyChapterTarget <= 0) {
    throw new Error('하루에 읽을 장수를 입력해주세요.');
  }

  const [{ data: plan, error: planError }, { data: days, error: daysError }, items, books] = await Promise.all([
    withApiTimeout(
      supabase
        .from('bible_reading_plans')
        .select('*')
        .eq('id', params.planId)
        .eq('owner_user_id', params.userId)
        .single(),
      '읽기표 수정 대상 조회'
    ),
    withApiTimeout(
      supabase
        .from('bible_reading_plan_days')
        .select('*')
        .eq('plan_id', params.planId)
        .order('day_number', { ascending: true }),
      '읽기표 수정 날짜 조회'
    ),
    fetchAllPlanItems(params.planId, '읽기표 수정 장 조회'),
    getBibleBooks(),
  ]);
  if (planError) throw planError;
  if (daysError) throw daysError;

  const completedItems = (items ?? []).filter(item => item.completed_at);
  const completedKeys = new Set(completedItems.map(item => buildChapterKey(item.book_id, item.chapter)));
  const targetChapters = buildBiblePlanChapters(books, params.scope)
    .filter(chapter => !completedKeys.has(buildChapterKey(chapter.bookId, chapter.chapter)));

  const completedCountByDay = new Map<string, number>();
  completedItems.forEach(item => {
    completedCountByDay.set(item.plan_day_id, (completedCountByDay.get(item.plan_day_id) ?? 0) + 1);
  });

  const completedDayIds = new Set(completedItems.map(item => item.plan_day_id));
  const daysToDelete = (days ?? []).filter(day => !completedDayIds.has(day.id));
  const completedDays = (days ?? []).filter(day => completedDayIds.has(day.id));

  const { error: deleteItemsError } = await withApiTimeout(
    supabase
      .from('bible_reading_plan_day_items')
      .delete()
      .eq('plan_id', params.planId)
      .is('completed_at', null),
    '미완료 읽기표 장 재배치 삭제'
  );
  if (deleteItemsError) throw deleteItemsError;

  if (daysToDelete.length > 0) {
    const { error: deleteDaysError } = await withApiTimeout(
      supabase
        .from('bible_reading_plan_days')
        .delete()
        .in('id', daysToDelete.map(day => day.id)),
      '미완료 읽기표 날짜 재배치 삭제'
    );
    if (deleteDaysError) throw deleteDaysError;
  }

  for (const day of completedDays) {
    const completedCount = completedCountByDay.get(day.id) ?? 0;
    const { error } = await withApiTimeout(
      supabase
        .from('bible_reading_plan_days')
        .update({
          chapter_count: completedCount,
          completed_at: day.completed_at ?? new Date().toISOString(),
        })
        .eq('id', day.id),
      '완료 읽기표 날짜 보존'
    );
    if (error) throw error;
  }

  const maxCompletedDayNumber = completedDays.reduce((max, day) => Math.max(max, day.day_number), 0);
  const maxCompletedSequence = completedItems.reduce((max, item) => Math.max(max, item.sequence), 0);
  const latestCompletedDate = completedDays.reduce(
    (latest, day) => day.scheduled_date > latest ? day.scheduled_date : latest,
    ''
  );
  const firstNewDate = latestCompletedDate
    ? (addDaysToDateString(latestCompletedDate, 1) > params.startDate
      ? addDaysToDateString(latestCompletedDate, 1)
      : params.startDate)
    : params.startDate;

  const dayChunks = chunkRows(targetChapters, params.dailyChapterTarget);
  let endDate = latestCompletedDate || params.startDate;

  if (dayChunks.length > 0) {
    const dayRows = dayChunks.map((chunk, index) => ({
      plan_id: params.planId,
      day_number: maxCompletedDayNumber + index + 1,
      scheduled_date: addDaysToDateString(firstNewDate, index),
      chapter_count: chunk.length,
    }));
    endDate = dayRows[dayRows.length - 1].scheduled_date;

    const { data: insertedDays, error: insertDaysError } = await withApiTimeout(
      supabase
        .from('bible_reading_plan_days')
        .insert(dayRows)
        .select('*'),
      '읽기표 수정 날짜 재생성'
    );
    if (insertDaysError) throw insertDaysError;

    const dayIdMap = new Map((insertedDays ?? []).map(day => [day.day_number, day.id]));
    const itemRows = dayChunks.flatMap((chunk, dayIndex) => {
      const dayNumber = maxCompletedDayNumber + dayIndex + 1;
      const planDayId = dayIdMap.get(dayNumber);
      if (!planDayId) return [];
      return chunk.map((chapter, chapterIndex) => ({
        plan_id: params.planId,
        plan_day_id: planDayId,
        sequence: maxCompletedSequence + dayIndex * params.dailyChapterTarget + chapterIndex + 1,
        book_id: chapter.bookId,
        chapter: chapter.chapter,
      }));
    });

    for (const batch of chunkRows(itemRows, 500)) {
      const { error } = await withApiTimeout(
        supabase.from('bible_reading_plan_day_items').insert(batch),
        '읽기표 수정 장 재생성'
      );
      if (error) throw error;
    }
  }

  const nextTitle = params.title.trim() || plan.title || '말씀을 읽는 기쁨';
  const { error: updatePlanError } = await withApiTimeout(
    supabase
      .from('bible_reading_plans')
      .update({
        title: nextTitle,
        scope: params.scope,
        start_date: completedItems.length > 0 ? plan.start_date : params.startDate,
        end_date: endDate,
        daily_chapter_target: params.dailyChapterTarget,
        total_chapters: completedItems.length + targetChapters.length,
        status: 'active',
      })
      .eq('id', params.planId),
    '읽기표 수정 저장'
  );
  if (updatePlanError) throw updatePlanError;

  const updated = await getPrimaryBibleReadingPlan(params.userId);
  if (!updated) throw new Error('수정된 읽기표를 불러오지 못했습니다.');
  return updated;
}

async function syncBiblePlanDayStatus(planDayId: string): Promise<void> {
  const [{ data: day, error: dayError }, { data: items, error: itemsError }] = await Promise.all([
    withApiTimeout(
      supabase.from('bible_reading_plan_days').select('*').eq('id', planDayId).single(),
      '읽기표 날짜 조회'
    ),
    withApiTimeout(
      supabase.from('bible_reading_plan_day_items').select('completed_at').eq('plan_day_id', planDayId),
      '읽기표 날짜 장 조회'
    ),
  ]);
  if (dayError) throw dayError;
  if (itemsError) throw itemsError;

  const completedCount = (items ?? []).filter(item => item.completed_at).length;
  const completedAt = completedCount === day.chapter_count ? new Date().toISOString() : null;
  const { error } = await withApiTimeout(
    supabase.from('bible_reading_plan_days').update({ completed_at: completedAt }).eq('id', planDayId),
    '읽기표 날짜 완료 상태 저장'
  );
  if (error) throw error;
}

async function syncBiblePlanLogById(logId: string, planId?: string): Promise<void> {
  let query = supabase
    .from('bible_reading_plan_day_items')
    .select('id')
    .eq('reading_log_id', logId)
    .not('completed_at', 'is', null);

  if (planId) {
    query = query.eq('plan_id', planId);
  }

  const { data: items, error: itemsError } = await withApiTimeout(
    query,
    '읽기표 자동 기록 장수 조회'
  );
  if (itemsError) throw itemsError;

  const completedCount = items?.length ?? 0;
  if (completedCount === 0) {
    const { error } = await withApiTimeout(
      supabase.from('bible_reading_logs').delete().eq('id', logId),
      '빈 읽기표 자동 기록 삭제'
    );
    if (error) throw error;
    return;
  }

  const { error } = await withApiTimeout(
    supabase.from('bible_reading_logs').update({ chapters: completedCount }).eq('id', logId),
    '읽기표 자동 기록 장수 갱신'
  );
  if (error) throw error;
}

async function attachTodayCompletedItemsToLog(params: {
  logId: string;
  planId: string;
  completedSince: string;
}): Promise<void> {
  const { data: items, error: itemsError } = await withApiTimeout(
    supabase
      .from('bible_reading_plan_day_items')
      .select('id')
      .eq('plan_id', params.planId)
      .not('completed_at', 'is', null)
      .gte('completed_at', params.completedSince),
    '오늘 완료한 읽기표 장 조회'
  );
  if (itemsError) throw itemsError;

  const itemIds = (items ?? []).map(item => item.id);
  if (itemIds.length > 0) {
    const { error } = await withApiTimeout(
      supabase
        .from('bible_reading_plan_day_items')
        .update({ reading_log_id: params.logId })
        .in('id', itemIds),
      '오늘 읽기표 장 자동 기록 연결'
    );
    if (error) throw error;
  }

  await syncBiblePlanLogById(params.logId, params.planId);
}

async function getOrCreateTodayBiblePlanLog(params: {
  userId: string;
  planId: string;
  sourceLabel: string;
}): Promise<string> {
  const today = getKSTDateString();
  const { data: existingLogs, error: lookupError } = await withApiTimeout(
    supabase
      .from('bible_reading_logs')
      .select('id')
      .eq('user_id', params.userId)
      .eq('source_type', 'plan')
      .eq('plan_id', params.planId)
      .eq('log_date', today)
      .eq('source_label', params.sourceLabel)
      .is('plan_day_id', null)
      .order('created_at', { ascending: true })
      .limit(1),
    '오늘 읽기표 자동 기록 조회'
  );
  if (lookupError) throw lookupError;
  const existingLog = existingLogs?.[0];
  if (existingLog) return existingLog.id;

  const { data: insertedLog, error } = await withApiTimeout(
    supabase
      .from('bible_reading_logs')
      .insert({
        user_id: params.userId,
        log_date: today,
        chapters: 1,
        source_type: 'plan',
        source_label: params.sourceLabel,
        plan_id: params.planId,
        plan_day_id: null,
      })
      .select('id')
      .single(),
    '오늘 읽기표 자동 기록 생성'
  );
  if (error) throw error;
  return insertedLog.id;
}

async function setBiblePlanItemCompletedWithLog(params: {
  itemId: string;
  completed: boolean;
}): Promise<BiblePlanChapterCompletionResult> {
  const { data: item, error: itemError } = await withApiTimeout(
    supabase
      .from('bible_reading_plan_day_items')
      .select('*, bible_reading_plans!inner(id, title, owner_user_id)')
      .eq('id', params.itemId)
      .single(),
    '읽기표 장 조회'
  );
  if (itemError) throw itemError;

  const plan = item.bible_reading_plans as {
    id: string;
    title: string;
    owner_user_id: string;
  };
  const oldLogId = item.reading_log_id as string | null;
  const alreadyCompleted = !!item.completed_at;

  if (params.completed) {
    if (alreadyCompleted) {
      await syncBiblePlanDayStatus(item.plan_day_id);
      return {
        planId: plan.id,
        planTitle: plan.title,
        planDayId: item.plan_day_id,
        itemId: item.id,
        alreadyCompleted: true,
      };
    }

    const completedAt = new Date().toISOString();
    const { error } = await withApiTimeout(
      supabase
        .from('bible_reading_plan_day_items')
        .update({
          completed_at: completedAt,
          reading_log_id: null,
        })
        .eq('id', item.id),
      '읽기표 장 완료 저장'
    );
    if (error) throw error;

    const logId = await getOrCreateTodayBiblePlanLog({
      userId: plan.owner_user_id,
      planId: plan.id,
      sourceLabel: plan.title,
    });
    await attachTodayCompletedItemsToLog({
      logId,
      planId: plan.id,
      completedSince: `${getKSTDateString()}T00:00:00+09:00`,
    });
  } else {
    const { error } = await withApiTimeout(
      supabase
        .from('bible_reading_plan_day_items')
        .update({
          completed_at: null,
          reading_log_id: null,
        })
        .eq('id', item.id),
      '읽기표 장 완료 해제'
    );
    if (error) throw error;
    if (oldLogId) await syncBiblePlanLogById(oldLogId, plan.id);
  }

  await syncBiblePlanDayStatus(item.plan_day_id);
  return {
    planId: plan.id,
    planTitle: plan.title,
    planDayId: item.plan_day_id,
    itemId: item.id,
    alreadyCompleted: false,
  };
}

export async function setBiblePlanItemCompleted(params: {
  planId: string;
  planDayId: string;
  itemId: string;
  completed: boolean;
}): Promise<void> {
  await setBiblePlanItemCompletedWithLog({
    itemId: params.itemId,
    completed: params.completed,
  });
}

export async function completeBiblePlanDay(params: {
  planId: string;
  planDayId: string;
}): Promise<void> {
  const { data: items, error } = await withApiTimeout(
    supabase
      .from('bible_reading_plan_day_items')
      .select('id')
      .eq('plan_day_id', params.planDayId)
      .is('completed_at', null),
    '읽기표 하루 미완료 장 조회'
  );
  if (error) throw error;
  for (const item of items ?? []) {
    await setBiblePlanItemCompletedWithLog({
      itemId: item.id,
      completed: true,
    });
  }
}

export async function completeCurrentBiblePlanChapter(params: {
  userId: string;
  bookId: number;
  chapter: number;
}): Promise<BiblePlanChapterCompletionResult> {
  const { data: plan, error: planError } = await withApiTimeout(
    supabase
      .from('bible_reading_plans')
      .select('id')
      .eq('owner_user_id', params.userId)
      .eq('status', 'active')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    '대표 읽기표 조회'
  );
  if (planError) throw planError;
  if (!plan) throw new Error('활성 읽기표가 없습니다.');

  const { data: item, error: itemError } = await withApiTimeout(
    supabase
      .from('bible_reading_plan_day_items')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('book_id', params.bookId)
      .eq('chapter', params.chapter)
      .maybeSingle(),
    '현재 장 읽기표 조회'
  );
  if (itemError) throw itemError;
  if (!item) throw new Error('현재 장은 대표 읽기표에 포함되어 있지 않습니다.');

  return setBiblePlanItemCompletedWithLog({
    itemId: item.id,
    completed: true,
  });
}

export async function getBibleReadingLogs(userId: string): Promise<BibleReadingLog[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_reading_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false }),
    '성경읽기 기록 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    userId: row.user_id,
    date: row.log_date,
    chapters: row.chapters,
    sourceType: row.source_type ?? 'manual',
    sourceLabel: row.source_label ?? '',
    planId: row.plan_id ?? null,
    planDayId: row.plan_day_id ?? null,
  }));
}

export async function addBibleReadingLog(params: {
  userId: string;
  date: string;
  chapters: number;
}): Promise<void> {
  const { error } = await withTimeout(
    supabase.from('bible_reading_logs').insert({
      user_id: params.userId,
      log_date: params.date,
      chapters: params.chapters,
      source_type: 'manual',
    }),
    15000,
    '성경읽기 저장 요청이 15초 내에 완료되지 않았습니다.'
  );
  if (error) throw error;
}

export async function updateBibleReadingLog(params: {
  id: string;
  chapters: number;
}): Promise<void> {
  const { error } = await withTimeout(
    supabase.from('bible_reading_logs').update({
      chapters: params.chapters,
    }).eq('id', params.id),
    15000,
    '성경읽기 수정 요청이 15초 내에 완료되지 않았습니다.'
  );
  if (error) throw error;
}

export async function deleteBibleReadingLog(id: string): Promise<void> {
  const { error } = await withTimeout(
    supabase.from('bible_reading_logs').delete().eq('id', id),
    15000,
    '성경읽기 삭제 요청이 15초 내에 완료되지 않았습니다.'
  );
  if (error) throw error;
}

export async function getTotalChapters(userId: string): Promise<number> {
  const { data, error } = await withApiTimeout(
    supabase.rpc('get_total_chapters', { p_user_id: userId }),
    '성경읽기 누적 조회'
  );
  if (error) throw error;
  return Number(data ?? 0);
}

export interface BibleReadingSummary {
  userId: string;
  userName: string;
  totalChapters: number;
}

export async function getAllBibleReadingSummaries(districtId: string): Promise<BibleReadingSummary[]> {
  const { data, error } = await withApiTimeout(
    supabase.rpc('get_bible_reading_summaries', { p_district_id: districtId }),
    '성경읽기 요약 조회'
  );
  if (error) throw error;
  return (data ?? []).map((row: { user_id: string; user_name: string; total_chapters: number }) => ({
    userId: row.user_id,
    userName: row.user_name,
    totalChapters: Number(row.total_chapters),
  }));
}

export async function getBibleReadingSummariesByRange(
  districtId: string,
  from: string,
  to: string
): Promise<BibleReadingSummary[]> {
  const { data, error } = await withApiTimeout(
    supabase.rpc('get_bible_reading_summaries_by_range', {
      p_district_id: districtId,
      p_from: from,
      p_to: to,
    }),
    '성경읽기 기간별 조회'
  );
  if (error) throw error;
  return (data ?? []).map((row: { user_id: string; user_name: string; total_chapters: number }) => ({
    userId: row.user_id,
    userName: row.user_name,
    totalChapters: Number(row.total_chapters),
  }));
}

// ============================================================
// 일정
// ============================================================

export async function getSchedules(districtId: string, options: ListOptions = {}): Promise<Schedule[]> {
  let query = supabase
    .from('schedules')
    .select('*')
    .eq('district_id', districtId)
    .order('schedule_date', { ascending: true });

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  const { data, error } = await withApiTimeout(
    query,
    '일정 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    title: row.title,
    date: row.schedule_date,
    time: row.schedule_time ?? '',
    location: row.location ?? '',
    memo: row.memo ?? '',
    attachment: row.attachment ?? '',
    attendanceCheck: row.attendance_check,
    createdBy: row.created_by,
    createdAt: row.created_at.slice(0, 10),
  }));
}

export async function getUpcomingSchedules(districtId: string, limit = 3): Promise<Schedule[]> {
  const today = getKSTDateString(new Date());
  const { data, error } = await withApiTimeout(
    supabase
      .from('schedules')
      .select('*')
      .eq('district_id', districtId)
      .gte('schedule_date', today)
      .order('schedule_date', { ascending: true })
      .limit(limit),
    '다가오는 일정 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    title: row.title,
    date: row.schedule_date,
    time: row.schedule_time ?? '',
    location: row.location ?? '',
    memo: row.memo ?? '',
    attachment: row.attachment ?? '',
    attendanceCheck: row.attendance_check,
    createdBy: row.created_by,
    createdAt: row.created_at.slice(0, 10),
  }));
}

export async function addSchedule(params: {
  title: string;
  date: string;
  time: string;
  location: string;
  memo: string;
  attachment: string;
  attendanceCheck: boolean;
  createdBy: string;
  districtId: string;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('schedules').insert({
      title: params.title,
      schedule_date: params.date,
      schedule_time: params.time || null,
      location: params.location || null,
      memo: params.memo || null,
      attachment: params.attachment || null,
      attendance_check: params.attendanceCheck,
      created_by: params.createdBy,
      district_id: params.districtId,
    }),
    '일정 등록'
  );
  if (error) throw error;
}

export async function updateSchedule(schedule: Schedule): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('schedules')
      .update({
        title: schedule.title,
        schedule_date: schedule.date,
        schedule_time: schedule.time || null,
        location: schedule.location || null,
        memo: schedule.memo || null,
        attachment: schedule.attachment || null,
        attendance_check: schedule.attendanceCheck,
      })
      .eq('id', schedule.id),
    '일정 수정'
  );
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('schedules').delete().eq('id', id),
    '일정 삭제'
  );
  if (error) throw error;
}

// ============================================================
// 출석
// ============================================================

export async function getAttendances(scheduleId: string): Promise<Attendance[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('attendances')
      .select('*, users(name)')
      .eq('schedule_id', scheduleId),
    '출석 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    scheduleId: row.schedule_id,
    userId: row.user_id,
    userName: (row.users as { name: string } | null)?.name ?? '알 수 없음',
    status: row.status as 'attending' | 'absent' | 'pending',
    updatedAt: row.updated_at.slice(0, 10),
  }));
}

export async function saveAttendance(params: {
  scheduleId: string;
  userId: string;
  status: 'attending' | 'absent' | 'pending';
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('attendances')
      .upsert(
        {
          schedule_id: params.scheduleId,
          user_id: params.userId,
          status: params.status,
        },
        { onConflict: 'schedule_id,user_id' }
      ),
    '출석 저장'
  );
  if (error) throw error;
}

// ============================================================
// 사용자 관리 (구역장 전용)
// ============================================================

export async function getAllUsers(districtId: string): Promise<FullUser[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('users')
      .select('id, name, role, status, created_at, district_id, districts(name)')
      .eq('district_id', districtId)
      .order('created_at', { ascending: true }),
    '구역원 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at.slice(0, 10),
    districtId: row.district_id,
    districtName: (row.districts as { name: string } | null)?.name ?? '',
  }));
}

export async function approveUser(userId: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('users')
      .update({ status: 'active' })
      .eq('id', userId),
    '구역원 승인'
  );
  if (error) throw error;
}

export async function rejectUser(userId: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('users').delete().eq('id', userId),
    '구역원 거절'
  );
  if (error) throw error;
}

export async function changeUserRole(userId: string, role: 'master' | 'leader' | 'member'): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('users')
      .update({ role })
      .eq('id', userId),
    '권한 변경'
  );
  if (error) throw error;
}

/** 마스터가 구역원의 비밀번호를 임시 비밀번호로 초기화한다 (Edge Function 호출) */
export async function adminResetUserPassword(
  userId: string,
  newPassword?: string
): Promise<{ userName: string; tempPassword: string }> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('요청 시간이 초과되었습니다 (15초)')), 15000)
  );
  const request = supabase.functions.invoke('admin-reset-password', {
    body: newPassword ? { userId, newPassword } : { userId },
  });
  const { data, error } = await Promise.race([request, timeout]);
  if (error) {
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }>; error?: string } }).context;
      if (ctx) {
        const body = typeof ctx.json === 'function' ? await ctx.json() : ctx;
        if (body?.error) throw new Error(body.error);
      }
    } catch (e) {
      if (e instanceof Error && e.message !== error.message) throw e;
    }
    const statusCode = (error as { context?: { status?: number } }).context?.status;
    if (statusCode === 401) {
      throw new Error('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 시도해주세요.');
    }
    throw error;
  }
  if (!data?.ok) throw new Error(data?.error || '비밀번호 초기화에 실패했습니다.');
  return { userName: data.userName, tempPassword: data.tempPassword };
}

export async function updateUserName(userId: string, name: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('users').update({ name }).eq('id', userId),
    '이름 변경'
  );
  if (error) throw error;
}

export async function updateLastLogin(userId: string): Promise<void> {
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);
  // 실패해도 로그인 흐름에 영향 주지 않음
}

export interface AccessInfo {
  id: string;
  name: string;
  lastLoginAt: string | null;
}

export async function getAccessInfo(districtId: string): Promise<AccessInfo[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('users')
      .select('id, name, last_login_at')
      .eq('status', 'active')
      .eq('district_id', districtId)
      .order('last_login_at', { ascending: false, nullsFirst: false }),
    '접속 정보 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    lastLoginAt: row.last_login_at ?? null,
  }));
}

// ============================================================
// Phase 4: 주간 마감 / 보고서
// ============================================================

export interface WeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  attendanceCount: number;
  attendanceNames: string[];
  bibleChaptersTotal: number;
  studyCompletionCount: number;
  reportText: string;
  isLocked: boolean;
  createdAt: string;
}

/** 현재 주(KST 기준 월요일 시작)가 마감됐는지 확인 */
export async function getCurrentLockStatus(districtId: string): Promise<boolean> {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kstNow.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(kstNow);
  monday.setUTCDate(kstNow.getUTCDate() - daysFromMonday);
  const weekStart = monday.toISOString().slice(0, 10);

  const { data } = await withApiTimeout(
    supabase
      .from('weekly_reports')
      .select('is_locked')
      .eq('week_start', weekStart)
      .eq('district_id', districtId)
      .maybeSingle(),
    '주간 마감 상태 조회'
  );

  return data?.is_locked === true;
}

export async function getWeeklyReports(districtId: string): Promise<WeeklyReport[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('weekly_reports')
      .select('*')
      .eq('district_id', districtId)
      .order('week_start', { ascending: false }),
    '주간 보고서 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    weekNumber: row.week_number ?? 0,
    attendanceCount: row.attendance_count ?? 0,
    attendanceNames: (row.attendance_names as string[]) ?? [],
    bibleChaptersTotal: row.bible_chapters_total ?? 0,
    studyCompletionCount: row.study_completion_count ?? 0,
    reportText: row.report_text ?? '',
    isLocked: row.is_locked,
    createdAt: row.created_at,
  }));
}

/** 마감 해제 — is_locked를 false로 설정 (구역장 전용) */
export async function unlockWeeklyReport(weekStart: string, districtId: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('weekly_reports')
      .update({ is_locked: false })
      .eq('week_start', weekStart)
      .eq('district_id', districtId),
    '주간 마감 해제'
  );
  if (error) throw error;
}

/** 현재 주 마감 집계 (구역장 전용, DB RPC 호출) */
export async function triggerWeeklyClose(weekStart?: string, districtId?: string): Promise<WeeklyReport> {
  let ws = weekStart;
  if (!ws) {
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dayOfWeek = kstNow.getUTCDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(kstNow);
    monday.setUTCDate(kstNow.getUTCDate() - daysFromMonday);
    ws = monday.toISOString().slice(0, 10);
  }
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('마감 집계 시간이 초과되었습니다 (30초)')), 30000)
  );
  const rpcParams: Record<string, unknown> = { p_week_start: ws };
  if (districtId) rpcParams.p_district_id = districtId;
  const { data, error } = await Promise.race([
    supabase.rpc('compute_weekly_report', rpcParams),
    timeout,
  ]);
  if (error) throw error;
  const r = data as Record<string, unknown>;
  return {
    id: '',
    weekStart: r.week_start as string,
    weekEnd: r.week_end as string,
    weekNumber: r.week_number as number,
    attendanceCount: r.attendance_count as number,
    attendanceNames: r.attendance_names as string[],
    bibleChaptersTotal: r.bible_chapters_total as number,
    studyCompletionCount: r.study_completion_count as number,
    reportText: r.report_text as string,
    isLocked: true,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================
// Phase 6: 주보 PDF 파싱
// ============================================================

export interface ParsedBulletinResult {
  sourceId: string;
  studyDate: string;
  title: string;
  pdfUrl: string;
  created: boolean;
}

/** 주보 PDF를 파싱하여 원본 1건을 study_sources에 등록한다 */
export async function parseBulletin(pdfUrl?: string): Promise<ParsedBulletinResult> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('요청 시간이 초과되었습니다 (120초)')), 120000)
  );
  const request = supabase.functions.invoke('parse-bulletin', {
    body: pdfUrl ? { pdf_url: pdfUrl } : {},
  });
  const { data, error } = await Promise.race([request, timeout]);
  if (error) {
    // FunctionsHttpError에서 실제 에러 메시지 추출 시도
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }>; error?: string } }).context;
      if (ctx) {
        const body = typeof ctx.json === 'function' ? await ctx.json() : ctx;
        if (body?.error) throw new Error(body.error);
      }
    } catch (e) {
      if (e instanceof Error && e.message !== error.message) throw e;
    }
    const statusCode = (error as { context?: { status?: number } }).context?.status;
    if (statusCode === 401) {
      throw new Error('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 시도해주세요.');
    }
    throw error;
  }
  if (!data?.ok) throw new Error(data?.error || '파싱 실패');
  return {
    sourceId: data.sourceId,
    studyDate: data.studyDate,
    title: data.title,
    pdfUrl: data.pdfUrl,
    created: data.created ?? true,
  };
}

// ============================================================
// Phase 5: 오늘의 묵상
// ============================================================

export interface DailyDevotional {
  id: string;
  date: string;
  verse: string;
  content: string;
  summary: string;
  applicationQuestion: string | null;
  sourceUrl: string | null;
  isFallback: boolean;
}

type DailyDevotionalRow = Database['public']['Tables']['daily_devotionals']['Row'];

export function mapDailyDevotional(
  row: DailyDevotionalRow,
  requestedDate = row.devotional_date
): DailyDevotional {
  return {
    id: row.id,
    date: row.devotional_date,
    verse: row.scripture ?? '',
    content: row.content ?? '',
    summary: row.summary ?? '',
    applicationQuestion: row.application_question ?? null,
    sourceUrl: row.source_url ?? null,
    isFallback: row.devotional_date !== requestedDate,
  };
}

/** 오늘(KST) 묵상 조회, 없으면 최근 묵상으로 fallback */
export async function getTodayDevotional(): Promise<DailyDevotional | null> {
  const today = getKSTDateString(new Date());

  const todayResult = await withApiTimeout(
    supabase
      .from('daily_devotionals')
      .select('*')
      .eq('devotional_date', today)
      .maybeSingle(),
    '오늘의 묵상 조회'
  );

  if (todayResult.error) throw todayResult.error;
  if (todayResult.data) return mapDailyDevotional(todayResult.data, today);

  const fallbackResult = await withApiTimeout(
    supabase
      .from('daily_devotionals')
      .select('*')
      .lte('devotional_date', today)
      .order('devotional_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    '최근 묵상 조회'
  );

  if (fallbackResult.error) throw fallbackResult.error;
  if (!fallbackResult.data) return null;
  return mapDailyDevotional(fallbackResult.data, today);
}

// ============================================================
// Phase 7-5: 앱 내 알림 센터
// ============================================================

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  isRead: boolean;
  districtId?: string | null;
  scopeType?: 'district' | 'service';
  notificationType?: string;
  payload?: Record<string, unknown>;
}

export interface PushSubscriptionDevice {
  id: string;
  endpoint: string;
  platform: string;
  userAgent: string | null;
  appVersion: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  scheduleEnabled: boolean;
  studyEnabled: boolean;
  devotionalEnabled: boolean;
  prayerEnabled: boolean;
  readingWeeklyEnabled: boolean;
  serviceNoticeEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  digestMode: 'instant' | 'daily' | 'weekly';
}

export async function getNotifications(userId: string, districtId: string): Promise<AppNotification[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('notifications')
      .select('*, notification_reads(user_id)')
      .or(`scope_type.eq.service,and(scope_type.eq.district,district_id.eq.${districtId}),and(scope_type.is.null,district_id.eq.${districtId})`)
      .order('created_at', { ascending: false })
      .limit(30),
    '알림 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({
      id: row.id,
      title: row.title,
      body: row.body,
      createdBy: row.created_by,
      createdAt: row.created_at,
      isRead: Array.isArray(row.notification_reads)
        ? row.notification_reads.some((r: { user_id: string }) => r.user_id === userId)
        : false,
      districtId: (row.district_id as string | null | undefined) ?? null,
      scopeType: ((row.scope_type as 'district' | 'service' | undefined) ?? 'district'),
      notificationType: (row.notification_type as string | undefined) ?? 'general',
      payload: (row.payload as Record<string, unknown> | undefined) ?? {},
    }));
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('notification_reads')
      .upsert({ notification_id: notificationId, user_id: userId }),
    '알림 읽음 처리'
  );
  if (error) throw error;
}

export async function createNotification(params: {
  title: string;
  body: string;
  createdBy: string;
  districtId?: string | null;
  scopeType?: 'district' | 'service';
  notificationType?: string;
  payload?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const scopeType = params.scopeType ?? 'district';
  const insertRow: Record<string, unknown> = {
    title: params.title,
    body: params.body,
    created_by: params.createdBy,
    district_id: params.districtId ?? null,
  };

  // 013 마이그레이션 적용 전에는 기존 컬럼만 사용하도록 두고,
  // 서비스 공지/타입형 알림을 사용할 때만 확장 컬럼을 추가한다.
  if (params.scopeType !== undefined || params.notificationType !== undefined || params.payload !== undefined) {
    insertRow.scope_type = scopeType;
    insertRow.notification_type = params.notificationType ?? 'general';
    insertRow.payload = params.payload ?? {};
    insertRow.district_id = scopeType === 'service' ? null : (params.districtId ?? null);
  }

  const { data, error } = await withApiTimeout(
    supabase.from('notifications').insert(insertRow).select('id').single(),
    '알림 생성'
  );
  if (error) throw error;
  return { id: data.id };
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('notifications').delete().eq('id', id),
    '알림 삭제'
  );
  if (error) throw error;
}

export interface PushDispatchResult {
  ok: boolean;
  dryRun: boolean;
  notificationId: string | null;
  targetCount: number;
  sentCount?: number;
  failedCount?: number;
  expiredCount?: number;
  error?: string;
}

export async function dispatchNotificationPush(notificationId: string): Promise<PushDispatchResult> {
  const { data, error } = await withApiTimeout(
    supabase.functions.invoke('push-dispatch', {
      body: {
        notificationId,
        dryRun: false,
      },
    }),
    '푸시 발송'
  );

  if (error) {
    const statusCode = (error as { context?: { status?: number } }).context?.status;
    if (statusCode === 401) {
      throw new Error('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 시도해주세요.');
    }
    throw error;
  }
  if (!data?.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : '푸시 발송에 실패했습니다.');
  }

  return data as PushDispatchResult;
}

const defaultNotificationPreferences: NotificationPreferences = {
  scheduleEnabled: true,
  studyEnabled: true,
  devotionalEnabled: true,
  prayerEnabled: true,
  readingWeeklyEnabled: true,
  serviceNoticeEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  digestMode: 'instant',
};

export async function getPushSubscriptions(userId: string): Promise<PushSubscriptionDevice[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('push_subscriptions')
      .select('id, endpoint, platform, user_agent, app_version, is_active, last_seen_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    '푸시 구독 조회'
  );
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    endpoint: row.endpoint,
    platform: row.platform,
    userAgent: row.user_agent,
    appVersion: row.app_version,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  }));
}

export async function savePushSubscription(params: {
  userId: string;
  districtId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  userAgent?: string | null;
  appVersion?: string | null;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('push_subscriptions')
      .upsert({
        user_id: params.userId,
        district_id: params.districtId,
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        platform: params.platform,
        user_agent: params.userAgent ?? null,
        app_version: params.appVersion ?? null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' }),
    '푸시 구독 저장'
  );
  if (error) throw error;
}

export async function deactivatePushSubscription(userId: string, endpoint: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('push_subscriptions')
      .update({
        is_active: false,
        last_seen_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('endpoint', endpoint),
    '푸시 구독 해지'
  );
  if (error) throw error;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    '알림 설정 조회'
  );
  if (error) throw error;
  if (!data) return defaultNotificationPreferences;

  return {
    scheduleEnabled: data.schedule_enabled,
    studyEnabled: data.study_enabled,
    devotionalEnabled: data.devotional_enabled,
    prayerEnabled: data.prayer_enabled,
    readingWeeklyEnabled: data.reading_weekly_enabled,
    serviceNoticeEnabled: data.service_notice_enabled,
    quietHoursStart: data.quiet_hours_start,
    quietHoursEnd: data.quiet_hours_end,
    digestMode: data.digest_mode,
  };
}

export async function saveNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferences>,
): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        schedule_enabled: patch.scheduleEnabled,
        study_enabled: patch.studyEnabled,
        devotional_enabled: patch.devotionalEnabled,
        prayer_enabled: patch.prayerEnabled,
        reading_weekly_enabled: patch.readingWeeklyEnabled,
        service_notice_enabled: patch.serviceNoticeEnabled,
        quiet_hours_start: patch.quietHoursStart,
        quiet_hours_end: patch.quietHoursEnd,
        digest_mode: patch.digestMode,
      }, { onConflict: 'user_id' }),
    '알림 설정 저장'
  );
  if (error) throw error;
}

// ============================================================
// Phase 7-1: 파일 업로드 (Supabase Storage)
// ============================================================

/** 일정 첨부파일을 Supabase Storage 'attachments' 버킷에 업로드하고 공개 URL 반환 */
export async function uploadScheduleAttachment(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await withApiTimeout(
    supabase.storage
      .from('attachments')
      .upload(fileName, file, { upsert: false }),
    '첨부파일 업로드',
    20000
  );
  if (error) throw error;
  const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
  return data.publicUrl;
}

// ============================================================
// QT (오늘의 묵상)
// ============================================================

export interface HymnSuggestion {
  title: string;
  type: string;
  youtube_url: string;
}

export interface QTContent {
  id: string;
  date: string;
  title: string | null;
  scripture: string | null;
  scriptureText: string | null;
  summary: string | null;
  question: string | null;
  prayer: string | null;
  application: string | null;
  audioUrl: string | null;
  hymnSuggestions: HymnSuggestion[];
  leaderComment: string | null;
  deepSummary: string | null;
  deepQuestions: string[] | null;
  createdAt: string;
}

export interface QTResponse {
  id: string;
  userId: string;
  contentId: string;
  answer: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  isPastDay: boolean;
  createdAt: string;
}

export interface Streak {
  userId: string;
  currentStreak: number;
  maxStreak: number;
  lastCompletedDate: string | null;
}

export interface QTMemberSummary {
  userId: string;
  userName: string;
  isCompleted: boolean;
  currentStreak: number;
  lastCompleted: string | null;
}

export interface QTCalendarDay {
  date: string;
  completed: boolean;
}

function mapQTContent(row: Record<string, unknown>): QTContent {
  return {
    id: row.id as string,
    date: row.date as string,
    title: (row.title as string) ?? null,
    scripture: (row.scripture as string) ?? null,
    scriptureText: (row.scripture_text as string) ?? null,
    summary: (row.summary as string) ?? null,
    question: (row.question as string) ?? null,
    prayer: (row.prayer as string) ?? null,
    application: (row.application as string) ?? null,
    audioUrl: (row.audio_url as string) ?? null,
    hymnSuggestions: Array.isArray(row.hymn_suggestions) ? (row.hymn_suggestions as HymnSuggestion[]) : [],
    leaderComment: (row.leader_comment as string) ?? null,
    deepSummary: (row.deep_summary as string) ?? null,
    deepQuestions: Array.isArray(row.deep_questions) ? (row.deep_questions as string[]) : null,
    createdAt: row.created_at as string,
  };
}

export async function getQTByDate(date: string): Promise<QTContent | null> {
  const { data, error } = await withApiTimeout(
    supabase.from('qt_contents').select('*').eq('date', date).maybeSingle(),
    'QT 조회'
  );
  if (error) throw error;
  return data ? mapQTContent(data as Record<string, unknown>) : null;
}

export async function getTodayQT(): Promise<QTContent | null> {
  const today = getKSTDateString(new Date());
  return getQTByDate(today);
}

/**
 * 베타(qt_scraping ON + simple 모드 교회) 전용: 벧엘 당일 QT를 내 교회로 복사 후 조회.
 * 복사가 실제 필요한 경우에만 호출한다(QTMain). 일반 경로는 getTodayQT(1회 왕복)를 쓴다.
 * 서버 RPC는 플래그 꺼짐/소스 교회/이미 복사됨이면 즉시 RETURN(무동작).
 */
export async function getTodayScrapedQTForBeta(): Promise<QTContent | null> {
  const today = getKSTDateString(new Date());
  try {
    await withApiTimeout(supabase.rpc('ensure_my_scraped_qt', { p_date: today }), 'QT 스크래핑 복사');
  } catch {
    // 복사 실패는 비치명적: 기존 콘텐츠 조회는 그대로 진행
  }
  return getQTByDate(today);
}

export async function getMyQTResponse(contentId: string, userId: string): Promise<QTResponse | null> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('qt_responses')
      .select('*')
      .eq('content_id', contentId)
      .eq('user_id', userId)
      .maybeSingle(),
    'QT 응답 조회'
  );
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    contentId: row.content_id as string,
    answer: (row.answer as string) ?? null,
    isCompleted: row.is_completed as boolean,
    completedAt: (row.completed_at as string) ?? null,
    isPastDay: row.is_past_day as boolean,
    createdAt: row.created_at as string,
  };
}

export async function upsertQTResponse(params: {
  contentId: string;
  userId: string;
  answer: string | null;
  isCompleted: boolean;
  isPastDay: boolean;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('qt_responses').upsert(
      {
        content_id: params.contentId,
        user_id: params.userId,
        answer: params.answer,
        is_completed: params.isCompleted,
        completed_at: params.isCompleted ? new Date().toISOString() : null,
        is_past_day: params.isPastDay,
      },
      { onConflict: 'user_id,content_id' }
    ),
    'QT 응답 저장'
  );
  if (error) throw error;
}

export async function updateQTStreak(userId: string): Promise<{ currentStreak: number; maxStreak: number }> {
  const today = getKSTDateString(new Date());

  const { data: existing, error: fetchErr } = await supabase
    .from('streaks')
    .select('current_streak, max_streak, last_completed_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  if (!existing) {
    const { error } = await supabase.from('streaks').insert({
      user_id: userId, current_streak: 1, max_streak: 1, last_completed_date: today,
    });
    if (error) throw error;
    return { currentStreak: 1, maxStreak: 1 };
  }

  const row = existing as { current_streak: number; max_streak: number; last_completed_date: string | null };
  if (row.last_completed_date === today) {
    return { currentStreak: row.current_streak, maxStreak: row.max_streak };
  }

  let current = row.current_streak;
  let max = row.max_streak;
  if (row.last_completed_date) {
    const diffDays = Math.floor(
      (new Date(today + 'T00:00:00').getTime() - new Date(row.last_completed_date + 'T00:00:00').getTime()) / 86400000
    );
    current = diffDays === 1 ? current + 1 : 1;
  } else {
    current = 1;
  }
  max = Math.max(max, current);

  const { error: updateErr } = await supabase
    .from('streaks')
    .update({ current_streak: current, max_streak: max, last_completed_date: today, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (updateErr) throw updateErr;

  return { currentStreak: current, maxStreak: max };
}

export async function hasEverPostedPrayer(userId: string): Promise<boolean> {
  const { count, error } = await withApiTimeout(
    supabase
      .from('prayer_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    '기도제목 작성 여부 확인'
  );
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function hasEverAnsweredStudy(userId: string): Promise<boolean> {
  const { count, error } = await withApiTimeout(
    supabase
      .from('study_answers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    '성경공부 답변 여부 확인'
  );
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function hasEverDoneQT(userId: string): Promise<boolean> {
  const { count, error } = await withApiTimeout(
    supabase
      .from('qt_responses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    'QT 참여 여부 확인'
  );
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function getMyStreak(userId: string): Promise<Streak | null> {
  const { data, error } = await withApiTimeout(
    supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle(),
    '스트릭 조회'
  );
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    userId: row.user_id as string,
    currentStreak: row.current_streak as number,
    maxStreak: row.max_streak as number,
    lastCompletedDate: (row.last_completed_date as string) ?? null,
  };
}

export async function getQTCalendar(userId: string, year: number, month: number): Promise<QTCalendarDay[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await withApiTimeout(
    supabase
      .from('qt_responses')
      .select('content_id, is_completed, qt_contents!inner(date)')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('qt_contents.date', from)
      .lte('qt_contents.date', to),
    'QT 캘린더 조회'
  );
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const contents = r.qt_contents as Record<string, unknown>;
    return { date: contents.date as string, completed: true };
  });
}

export async function updateQTLeaderComment(date: string, comment: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('qt_contents').update({ leader_comment: comment }).eq('date', date),
    '구역장 코멘트 저장'
  );
  if (error) throw error;
}

export async function getQTDistrictSummary(districtId: string, date?: string): Promise<QTMemberSummary[]> {
  const params: Record<string, unknown> = { p_district_id: districtId };
  if (date) params.p_date = date;
  const { data, error } = await withApiTimeout(
    supabase.rpc('get_qt_district_summary', params),
    'QT 구역 현황 조회'
  );
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    userId: row.user_id as string,
    userName: row.user_name as string,
    isCompleted: row.is_completed as boolean,
    currentStreak: row.current_streak as number,
    lastCompleted: (row.last_completed as string) ?? null,
  }));
}

/** 주어진 날짜의 ISO 주차 번호 */
export function getISOWeekNumber(dateStr: string): number {
  const date = new Date(dateStr);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ============================================================
// 깊은 묵상 (4단계 묵상)
// ============================================================

export type DeepMeditationState =
  | 'OBSERVING'
  | 'ADDING_QUESTIONS'
  | 'ANSWERING'
  | 'FEELING'
  | 'DECIDING'
  | 'DONE';

export interface DeepMeditationQuestion {
  text: string;
  source: 'ai' | 'user';
}

export interface DeepMeditation {
  id: string;
  userId: string;
  date: string;
  state: DeepMeditationState;
  aiSummary: string | null;
  observation: string | null;
  questions: DeepMeditationQuestion[];
  answers: string[];
  currentQIndex: number;
  feelings: string | null;
  decision: string | null;
}

function mapDeepMeditation(row: Record<string, unknown>): DeepMeditation {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    date: row.date as string,
    state: row.state as DeepMeditationState,
    aiSummary: (row.ai_summary as string) ?? null,
    observation: (row.observation as string) ?? null,
    questions: Array.isArray(row.questions) ? (row.questions as DeepMeditationQuestion[]) : [],
    answers: Array.isArray(row.answers) ? (row.answers as string[]) : [],
    currentQIndex: (row.current_q_index as number) ?? 0,
    feelings: (row.feelings as string) ?? null,
    decision: (row.decision as string) ?? null,
  };
}

export async function getDeepMeditation(userId: string, date: string): Promise<DeepMeditation | null> {
  const { data, error } = await withApiTimeout(
    supabase.from('deep_meditations').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    '깊은 묵상 조회'
  );
  if (error) throw error;
  return data ? mapDeepMeditation(data as Record<string, unknown>) : null;
}

const DEEP_MEDITATION_DEFAULT_QUESTIONS = [
  '이 말씀에서 가장 인상 깊은 구절은 무엇인가요? 그 이유는?',
  '이 말씀에 등장하는 인물이나 사건에서 하나님의 성품을 어떻게 발견할 수 있나요?',
  '이 말씀이 오늘 나의 삶과 어떻게 연결되나요?',
  '이 말씀을 통해 오늘 하루 어떻게 살아야 할지 구체적으로 적어보세요.',
];

/**
 * 깊은 묵상 시작용 AI 요약+질문 생성.
 * qt_contents에 일별 캐시가 있으면 호출 없이 즉시 반환하고,
 * Edge Function 실패 시에도 QT 콘텐츠 기반 폴백으로 항상 결과를 반환한다.
 */
export async function generateDeepMeditationAI(
  date: string,
  qtFallback: {
    summary: string | null;
    scriptureText: string | null;
    deepSummary?: string | null;
    deepQuestions?: string[] | null;
  }
): Promise<{ summary: string; questions: string[] }> {
  // 일별 캐시 히트: 같은 날 다른 사용자가 이미 생성한 결과 재사용 (AI 호출 0회)
  if (qtFallback.deepSummary && qtFallback.deepQuestions && qtFallback.deepQuestions.length > 0) {
    return { summary: qtFallback.deepSummary, questions: qtFallback.deepQuestions };
  }
  const fallback = {
    summary:
      qtFallback.summary?.trim()
      || qtFallback.scriptureText?.slice(0, 300)
      || '오늘의 말씀을 천천히 읽으며 묵상해보세요.',
    questions: DEEP_MEDITATION_DEFAULT_QUESTIONS,
  };
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI 생성 시간 초과')), 30000)
    );
    const request = supabase.functions.invoke('deep-meditation-ai', { body: { date } });
    const { data, error } = await Promise.race([request, timeout]);
    if (error || !data?.ok) return fallback;
    return {
      summary: (data.summary as string) || fallback.summary,
      questions: Array.isArray(data.questions) && data.questions.length > 0
        ? (data.questions as string[])
        : fallback.questions,
    };
  } catch {
    return fallback;
  }
}

export async function createDeepMeditation(params: {
  userId: string;
  date: string;
  aiSummary: string;
  questions: DeepMeditationQuestion[];
}): Promise<DeepMeditation> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('deep_meditations')
      .insert({
        user_id: params.userId,
        date: params.date,
        state: 'OBSERVING',
        ai_summary: params.aiSummary,
        questions: params.questions,
        answers: [],
      })
      .select('*')
      .single(),
    '깊은 묵상 시작'
  );
  if (error) throw error;
  return mapDeepMeditation(data as Record<string, unknown>);
}

export async function updateDeepMeditation(
  id: string,
  patch: Partial<{
    state: DeepMeditationState;
    observation: string | null;
    questions: DeepMeditationQuestion[];
    answers: string[];
    currentQIndex: number;
    feelings: string | null;
    decision: string | null;
  }>
): Promise<DeepMeditation> {
  const row: Record<string, unknown> = {};
  if (patch.state !== undefined) row.state = patch.state;
  if (patch.observation !== undefined) row.observation = patch.observation;
  if (patch.questions !== undefined) row.questions = patch.questions;
  if (patch.answers !== undefined) row.answers = patch.answers;
  if (patch.currentQIndex !== undefined) row.current_q_index = patch.currentQIndex;
  if (patch.feelings !== undefined) row.feelings = patch.feelings;
  if (patch.decision !== undefined) row.decision = patch.decision;

  const { data, error } = await withApiTimeout(
    supabase.from('deep_meditations').update(row).eq('id', id).select('*').single(),
    '깊은 묵상 저장'
  );
  if (error) throw error;
  return mapDeepMeditation(data as Record<string, unknown>);
}

export async function deleteDeepMeditation(id: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('deep_meditations').delete().eq('id', id),
    '깊은 묵상 취소'
  );
  if (error) throw error;
}

// ============================================================
// 교회 설정 (SaaS) — RLS가 자기 교회 행만 반환하므로 프론트는 교회를 모른다
// ============================================================

export type QTMode = 'scraped' | 'admin' | 'simple';

export interface ChurchSettings {
  qtMode: QTMode;
  modules: Record<string, boolean>;
  bulletinUrlPattern: string | null;
  terms: Record<string, string>;
  qtSimpleBook: string;
  name: string;
  slug: string;
  status: string;
  billingStatus: string;
  isTrialing: boolean;
  trialDaysLeft: number;
  plan: string;
  uiMode: 'simple' | 'full';
  isPendingDeletion: boolean;
  deletionDate: string | null;
  /** 베타 기간 한시 개방 모듈 (슈퍼어드민 토글). 전역 설정. */
  betaOpenModules: string[];
}

/**
 * legacy 플랜은 모든 모듈 허용 (기존 교회).
 * 베타 기간 한시 개방 모듈(슈퍼어드민 토글)은 모든 가입자에게 열림.
 * bible_text를 제외한 모든 모듈은 trialing 중에 열림.
 * bible_text는 라이센스 계약이 필요하므로 trial에서도 modules 값만 따름.
 */
export function hasModule(settings: ChurchSettings | null | undefined, module: string): boolean {
  if (!settings) return false;
  if (settings.plan === 'legacy') return true;
  if (settings.betaOpenModules.includes(module)) return true; // 베타 한시 개방 (슈퍼어드민 토글)
  const LEGACY_ONLY_MODULES = ['bible_text', 'bulletin_parsing'];
  if (!LEGACY_ONLY_MODULES.includes(module) && settings.isTrialing) return true;
  return settings.modules[module] ?? false;
}

export interface BetaFlag {
  module: string;
  enabled: boolean;
}

/** 베타 모듈 플래그 전체 조회 (전역). */
export async function getBetaFlags(): Promise<BetaFlag[]> {
  const { data, error } = await withApiTimeout(
    supabase.rpc('get_beta_flags'),
    '베타 플래그 조회'
  );
  if (error) throw error;
  return ((data as { module: string; enabled: boolean }[] | null) ?? []).map(r => ({
    module: r.module,
    enabled: r.enabled,
  }));
}

/** 베타 모듈 플래그 토글 (슈퍼어드민 전용). */
export async function setBetaFlag(module: string, enabled: boolean): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.rpc('set_beta_flag', { p_module: module, p_enabled: enabled }),
    '베타 플래그 변경'
  );
  if (error) throw error;
}

/**
 * 내 교회 설정 조회 (church_settings + churches trial 상태 병합).
 * 테이블이 없거나(021/027 미적용 prod) 행이 없으면 null → 호출측은 현행(scraped) 동작 유지.
 */
export async function getMyChurchSettings(): Promise<ChurchSettings | null> {
  // allSettled: 한 쪽 타임아웃이 다른 쪽을 죽이지 않음
  const [settingsResult, infoResult, betaResult] = await Promise.allSettled([
    withApiTimeout(
      supabase.from('church_settings').select('*').limit(1).maybeSingle(),
      '교회 설정 조회'
    ),
    withApiTimeout(supabase.rpc('get_my_church_info'), '교회 정보 조회'),
    withApiTimeout(supabase.rpc('get_beta_flags'), '베타 플래그 조회'),
  ]);

  // 설정 조회가 '일시 실패(타임아웃/네트워크)'면 throw → React Query가 직전 캐시를 유지.
  // null을 반환하면 hasModule이 fail-closed로 떨어져 본문 접근이 깜빡이는 문제 방지.
  if (settingsResult.status === 'rejected') {
    throw settingsResult.reason ?? new Error('교회 설정 조회 지연');
  }

  const settingsRes = settingsResult.value;
  // 테이블 미존재(027 미적용 prod)·행 없음 등 '확정적 무설정'은 null → 호출측 scraped 폴백
  const row = !settingsRes.error && settingsRes.data
    ? (settingsRes.data as Record<string, unknown>)
    : null;

  const infoRows = infoResult.status === 'fulfilled' && !infoResult.value.error
    ? ((infoResult.value.data as Record<string, unknown>[] | null) ?? [])
    : [];
  const info = infoRows[0] ?? null;

  // 설정 행도 없고 교회 정보도 없으면 설정 없음으로 간주 (현행 동작 유지)
  if (!row && !info) return null;

  const settingsRow = row ?? {};
  const trialEndsAt = info ? (info.trial_ends_at as string | null) : null;
  const trialMs = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  // billing_status가 'trialing'인 동안은 만료 여부와 무관하게 체험 상태로 간주.
  // 슈퍼어드민이 billing_status를 변경할 때만 모듈이 잠김.
  const isBillingTrialing = info?.billing_status === 'trialing';
  const isTrialing = isBillingTrialing && trialMs > 0;
  const trialDaysLeft = isBillingTrialing ? Math.max(0, Math.ceil(trialMs / 86400000)) : 0;

  // 베타 플래그: 조회 실패 시 빈 배열(게이팅 보수적). enabled=true인 모듈만 개방.
  const betaRows = betaResult.status === 'fulfilled' && !betaResult.value.error
    ? ((betaResult.value.data as { module: string; enabled: boolean }[] | null) ?? [])
    : [];
  const betaOpenModules = betaRows.filter(r => r.enabled).map(r => r.module);

  return {
    qtMode: (settingsRow.qt_mode as QTMode) ?? 'simple',
    modules: (settingsRow.modules as Record<string, boolean>) ?? {},
    bulletinUrlPattern: (settingsRow.bulletin_url_pattern as string) ?? null,
    terms: (settingsRow.terms as Record<string, string>) ?? {},
    qtSimpleBook: (settingsRow.qt_simple_book as string) ?? '시편',
    name: info ? (info.name as string) : '',
    slug: info ? (info.slug as string) : '',
    status: info ? (info.status as string) : 'unknown',
    billingStatus: info ? (info.billing_status as string) : 'unknown',
    isTrialing: isBillingTrialing as boolean,
    trialDaysLeft,
    plan: info ? (info.plan as string) : 'unknown',
    uiMode: (settingsRow.ui_mode as 'simple' | 'full') ?? 'full',
    isPendingDeletion: !!(info as Record<string, unknown>)?.deleted_at,
    deletionDate: ((info as Record<string, unknown>)?.deleted_at as string) ?? null,
    betaOpenModules,
  };
}

export async function assignMyDistrict(districtId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_my_district', { p_district_id: districtId });
  if (error) throw error;
}

export async function deleteMyAccount(): Promise<{ error?: string; message?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: '로그인 필요' };

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
    {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'content-type': 'application/json',
      },
    }
  );
  const json = await res.json() as { success?: boolean; error?: string; message?: string };
  if (!res.ok) return { error: json.error, message: json.message };
  return {};
}


// ============================================================
// QT simple 모드: 시편 1일 1편 (자체 성경 DB, 외부 의존/저작권 없음)
// ============================================================

/** KST 날짜 기준 day-of-year → 해당 책 장 번호 (1~chapterCount 순환) */
export function getSimpleQTChapter(dateStr: string, chapterCount: number): number {
  const date = new Date(dateStr + 'T00:00:00');
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;
  return ((dayOfYear - 1) % chapterCount) + 1;
}

/** @deprecated getSimpleQTChapter 사용 */
export function getSimplePsalmChapter(dateStr: string): number {
  return getSimpleQTChapter(dateStr, 150);
}

/**
 * simple 모드용 오늘 QT 콘텐츠를 lazy 생성한다.
 * 이미 있으면 그대로 반환. 동시 생성 race는 UNIQUE 충돌 후 재조회로 해소.
 * (church_id는 DB 트리거가 호출자 교회로 자동 설정)
 * @param bookName bible_books.korean_name 기준 책 이름 (기본: '시편')
 */
export async function getOrCreateSimpleQT(date: string, bookName = '시편'): Promise<QTContent | null> {
  const existing = await getQTByDate(date);
  if (existing) return existing;

  const { data: book, error: bookError } = await withApiTimeout(
    supabase.from('bible_books').select('id, chapter_count').eq('korean_name', bookName).single(),
    '성경 책 조회'
  );
  if (bookError) throw new Error(`bible_books 조회 실패 (${bookName}): ${bookError.message}`);
  if (!book) throw new Error(`bible_books에 '${bookName}' 행이 없습니다. 성경 시드를 확인하세요.`);

  const { id: bookId, chapter_count: chapterCount } = book as { id: number; chapter_count: number };
  const chapter = getSimpleQTChapter(date, chapterCount);

  const { data: verses, error: versesError } = await withApiTimeout(
    supabase
      .from('bible_verses')
      .select('verse, text')
      .eq('book_id', bookId)
      .eq('chapter', chapter)
      .order('verse'),
    '성경 본문 조회'
  );
  if (versesError) throw new Error(`bible_verses 조회 실패 (${bookName} ${chapter}장): ${versesError.message}`);
  if (!verses || verses.length === 0) throw new Error(`bible_verses에 ${bookName} ${chapter}장 데이터 없음.`);

  const scriptureText = (verses as { verse: number; text: string }[])
    .map(v => `${v.verse} ${v.text}`)
    .join('\n');

  // 시편은 '편', 그 외 책은 '장'
  const chapterLabel = bookName === '시편' ? `${chapter}편` : `${chapter}장`;
  const title = `${bookName} ${chapterLabel}`;

  const { data: created, error: insertError } = await withApiTimeout(
    supabase
      .from('qt_contents')
      .insert({
        date,
        title,
        scripture: title,
        scripture_text: scriptureText,
        question: '오늘 말씀에서 마음에 와닿은 구절은 무엇인가요? 그 이유도 함께 묵상해보세요.',
      })
      .select('*')
      .single(),
    'QT 생성'
  );

  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      return getQTByDate(date);
    }
    throw insertError;
  }
  return mapQTContent(created as Record<string, unknown>);
}

// ============================================================
// 교회 설정 관리 (church master 전용)
// ============================================================

export async function updateChurchQTSimpleBook(bookName: string): Promise<void> {
  // church_settings는 RLS(church_settings_update_master)로 자기 교회 행만 UPDATE 가능
  // not('church_id', 'is', null)은 전체 행 대상 필터로 RLS가 교회 범위를 제한
  const { error } = await withApiTimeout(
    supabase
      .from('church_settings')
      .update({ qt_simple_book: bookName })
      .not('church_id', 'is', null),
    'QT 책 설정 변경'
  );
  if (error) throw error;
}

// ============================================================
// 고객지원 (support_tickets)
// ============================================================

export interface SupportTicket {
  id: string;
  church_id: string;
  user_id: string;
  ticket_type: 'bug' | 'feature' | 'question' | 'other';
  title: string;
  content: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  github_issue_number: number | null;
  github_issue_url: string | null;
  admin_reply: string | null;
  replied_at: string | null;
  reply_read_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false }),
    '내 문의 목록 조회'
  );
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

export async function getUnreadReplyCount(): Promise<number> {
  const { count, error } = await withApiTimeout(
    supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .not('admin_reply', 'is', null)
      .is('reply_read_at', null),
    '미확인 답변 수 조회'
  );
  if (error) return 0;
  return count ?? 0;
}

export async function markTicketReplyRead(ticketId: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.rpc('mark_ticket_read', { p_ticket_id: ticketId }),
    '답변 확인 처리'
  );
  if (error) throw error;
}

// ============================================================
// 슈퍼어드민 전용
// ============================================================

export interface SuperAdminChurch {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  billing_status: string;
  trial_ends_at: string | null;
  created_at: string;
  deleted_at: string | null;
  ui_mode: string;
  qt_mode: string;
  district_count: number;
  member_count: number;
  master_id: string | null;
  master_name: string | null;
  master_email: string | null;
}

export async function restoreChurchSuperAdmin(churchId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_church_superadmin', { p_church_id: churchId });
  if (error) throw error;
}

export async function hardDeleteChurchSuperAdmin(churchId: string): Promise<void> {
  const { error } = await supabase.rpc('hard_delete_church_superadmin', { p_church_id: churchId });
  if (error) throw error;
}

export async function resetMasterPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function getAllChurchesSuperAdmin(): Promise<SuperAdminChurch[]> {
  const { data, error } = await withApiTimeout(
    supabase.rpc('get_all_churches_superadmin'),
    '슈퍼어드민 교회 목록 조회'
  );
  if (error) throw error;
  return (data ?? []) as SuperAdminChurch[];
}

export async function updateChurchSuperAdmin(params: {
  churchId: string;
  plan: string;
  status: string;
  billingStatus: string;
  trialEndsAt: string | null;
  uiMode: string;
  qtMode: string;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.rpc('update_church_superadmin', {
      p_church_id:      params.churchId,
      p_plan:           params.plan,
      p_status:         params.status,
      p_billing_status: params.billingStatus,
      p_trial_ends_at:  params.trialEndsAt,
      p_ui_mode:        params.uiMode,
      p_qt_mode:        params.qtMode,
    }),
    '슈퍼어드민 교회 정보 수정'
  );
  if (error) throw error;
}

/** 마스터가 자신의 마스터 권한을 다른 구성원에게 이관한다 */
export async function transferMasterRole(newMasterId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_master', { p_new_master_id: newMasterId });
  if (error) throw error;
}

export interface ChurchMemberBasic {
  id: string;
  name: string;
  role: string;
  district_name: string;
}

export async function getChurchMembersSuperAdmin(churchId: string): Promise<ChurchMemberBasic[]> {
  const { data, error } = await withApiTimeout(
    supabase.rpc('get_church_members_superadmin', { p_church_id: churchId }),
    '슈퍼어드민 구성원 목록'
  );
  if (error) throw error;
  return (data ?? []) as ChurchMemberBasic[];
}

export async function changeMasterSuperAdmin(churchId: string, newMasterId: string): Promise<void> {
  const { error } = await supabase.rpc('change_master_superadmin', {
    p_church_id:      churchId,
    p_new_master_id:  newMasterId,
  });
  if (error) throw error;
}

export function getKSTWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(kst);
  monday.setUTCDate(kst.getUTCDate() + diffToMonday);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}

export async function getWeeklyChapterCount(userId: string): Promise<number> {
  const { weekStart, weekEnd } = getKSTWeekRange();
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_reading_logs')
      .select('chapters')
      .eq('user_id', userId)
      .gte('log_date', weekStart)
      .lte('log_date', weekEnd),
    '이번 주 성경읽기 장수 조회'
  );
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (Number(row.chapters) || 0), 0);
}

export async function getMyWeeklyPrayerCount(userId: string): Promise<number> {
  const { weekStart, weekEnd } = getKSTWeekRange();
  const { count, error } = await withApiTimeout(
    supabase
      .from('prayer_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${weekStart}T00:00:00+09:00`)
      .lte('created_at', `${weekEnd}T23:59:59+09:00`),
    '이번 주 내 기도제목 수 조회'
  );
  if (error) throw error;
  return count ?? 0;
}

// ── 나 탭 연간 누적 통계 ──────────────────────────────────────────

export async function getYearlyQTCount(userId: string, year: number): Promise<number> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('qt_responses')
      .select('qt_contents!inner(date)')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('qt_contents.date', `${year}-01-01`)
      .lte('qt_contents.date', `${year}-12-31`),
    '연간 QT 일수 조회'
  );
  if (error) throw error;
  return (data ?? []).length;
}

export async function getYearlyChapterCount(userId: string, year: number): Promise<number> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_reading_logs')
      .select('chapters')
      .eq('user_id', userId)
      .gte('log_date', `${year}-01-01`)
      .lte('log_date', `${year}-12-31`),
    '연간 성경읽기 장수 조회'
  );
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (Number(row.chapters) || 0), 0);
}

export async function getYearlyStudyCompletedCount(userId: string, year: number): Promise<number> {
  const { count, error } = await withApiTimeout(
    supabase
      .from('bible_study_answers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('updated_at', `${year}-01-01T00:00:00+09:00`)
      .lte('updated_at', `${year}-12-31T23:59:59+09:00`),
    '연간 성경공부 완료 건수 조회'
  );
  if (error) throw error;
  return count ?? 0;
}

export async function getYearlyPrayerCount(userId: string, year: number): Promise<number> {
  const { count, error } = await withApiTimeout(
    supabase
      .from('prayer_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${year}-01-01T00:00:00+09:00`)
      .lte('created_at', `${year}-12-31T23:59:59+09:00`),
    '연간 기도제목 건수 조회'
  );
  if (error) throw error;
  return count ?? 0;
}

export interface ActivityDay {
  date: string;
  qtDone: boolean;
  readingDone: boolean;
  hasSchedule: boolean;
}

export async function getActivityCalendar(
  userId: string,
  districtId: string,
  year: number,
  month: number
): Promise<ActivityDay[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [qtRes, readingRes, scheduleRes] = await Promise.all([
    withApiTimeout(
      supabase
        .from('qt_responses')
        .select('qt_contents!inner(date)')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('qt_contents.date', from)
        .lte('qt_contents.date', to),
      'QT 활동 캘린더 조회'
    ),
    withApiTimeout(
      supabase
        .from('bible_reading_logs')
        .select('log_date')
        .eq('user_id', userId)
        .gte('log_date', from)
        .lte('log_date', to),
      '성경읽기 활동 캘린더 조회'
    ),
    withApiTimeout(
      supabase
        .from('schedules')
        .select('date')
        .eq('district_id', districtId)
        .gte('date', from)
        .lte('date', to),
      '일정 캘린더 조회'
    ),
  ]);

  const qtDates = new Set(
    (qtRes.data ?? []).map(r => ((r as Record<string, unknown>).qt_contents as { date: string }).date)
  );
  const readingDates = new Set((readingRes.data ?? []).map(r => r.log_date as string));
  const scheduleDates = new Set((scheduleRes.data ?? []).map(r => r.date as string));

  const days: ActivityDay[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      date: dateStr,
      qtDone: qtDates.has(dateStr),
      readingDone: readingDates.has(dateStr),
      hasSchedule: scheduleDates.has(dateStr),
    });
  }
  return days;
}

// ============================================================
// 구역장 주간 체크리스트
// ============================================================

export interface LeaderChecklist {
  bibleStudyRegistered: boolean;
  scheduleRegistered: boolean;
  qtExists: boolean;
  attendanceScheduleExists: boolean;
  attendanceChecked: boolean;
  memberCount: number;
}

export async function getLeaderWeeklyChecklist(districtId: string): Promise<LeaderChecklist> {
  const { weekStart, weekEnd } = getKSTWeekRange();
  const today = getKSTDateString();

  const [studyRes, scheduleRes, qtRes, memberRes] = await Promise.all([
    withApiTimeout(
      supabase.from('bible_studies')
        .select('id', { count: 'exact', head: true })
        .eq('district_id', districtId)
        .gte('study_date', weekStart)
        .lte('study_date', weekEnd),
      '체크리스트 - 성경공부 등록'
    ),
    withApiTimeout(
      supabase.from('schedules')
        .select('id, attendance_check')
        .eq('district_id', districtId)
        .gte('schedule_date', weekStart)
        .lte('schedule_date', weekEnd),
      '체크리스트 - 일정 조회'
    ),
    withApiTimeout(
      supabase.from('qt_contents')
        .select('date', { count: 'exact', head: true })
        .eq('date', today),
      '체크리스트 - QT 배포 확인'
    ),
    withApiTimeout(
      supabase.from('users')
        .select('id', { count: 'exact', head: true })
        .eq('district_id', districtId)
        .eq('status', 'active'),
      '체크리스트 - 구역원 수'
    ),
  ]);

  const weekSchedules = (scheduleRes.data ?? []) as { id: string; attendance_check: boolean }[];
  const attendanceSchedule = weekSchedules.find(s => s.attendance_check);

  let attendanceChecked = false;
  if (attendanceSchedule) {
    const { count } = await withApiTimeout(
      supabase.from('attendances')
        .select('id', { count: 'exact', head: true })
        .eq('schedule_id', attendanceSchedule.id)
        .eq('status', 'attending'),
      '체크리스트 - 출석 기록'
    );
    attendanceChecked = (count ?? 0) > 0;
  }

  return {
    bibleStudyRegistered: (studyRes.count ?? 0) > 0,
    scheduleRegistered: weekSchedules.length > 0,
    qtExists: (qtRes.count ?? 0) > 0,
    attendanceScheduleExists: !!attendanceSchedule,
    attendanceChecked,
    memberCount: memberRes.count ?? 0,
  };
}
