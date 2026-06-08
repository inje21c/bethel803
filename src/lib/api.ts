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

export async function getActiveDistricts(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await withApiTimeout(
    supabase.from('districts').select('id, name').eq('is_active', true).order('name'),
    '활성 구역 조회'
  );
  if (error) throw error;
  return (data ?? []).map(row => ({ id: row.id, name: row.name }));
}

export async function createDistrict(params: { name: string; description: string }): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('districts').insert({
      name: params.name,
      description: params.description || null,
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

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
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

  const [{ data: days, error: daysError }, { data: items, error: itemsError }, books] = await Promise.all([
    withApiTimeout(
      supabase
        .from('bible_reading_plan_days')
        .select('*')
        .eq('plan_id', plan.id)
        .order('day_number', { ascending: true }),
      '읽기표 날짜 조회'
    ),
    withApiTimeout(
      supabase
        .from('bible_reading_plan_day_items')
        .select('*')
        .eq('plan_id', plan.id)
        .order('sequence', { ascending: true }),
      '읽기표 장 목록 조회'
    ),
    getBibleBooks(),
  ]);
  if (daysError) throw daysError;
  if (itemsError) throw itemsError;

  return mapPlan(plan, days ?? [], items ?? [], books);
}

export async function createBibleReadingPlan(params: {
  userId: string;
  title: string;
  scope: BibleReadingPlanScope;
  startDate: string;
  dailyChapterTarget: number;
}): Promise<BibleReadingPlan> {
  const books = await getBibleBooks();
  const selectedBooks = books.filter(book => {
    if (params.scope === 'old') return book.testament === 'old';
    if (params.scope === 'new') return book.testament === 'new';
    return true;
  });
  const chapters = selectedBooks.flatMap(book =>
    Array.from({ length: book.chapterCount }, (_, index) => ({
      bookId: book.id,
      chapter: index + 1,
    }))
  );
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

async function syncBiblePlanDayLog(params: {
  planId: string;
  planDayId: string;
}): Promise<void> {
  const { data: plan, error: planError } = await withApiTimeout(
    supabase.from('bible_reading_plans').select('*').eq('id', params.planId).single(),
    '읽기표 동기화 계획 조회'
  );
  if (planError) throw planError;

  const [{ data: day, error: dayError }, { data: items, error: itemsError }] = await Promise.all([
    withApiTimeout(
      supabase.from('bible_reading_plan_days').select('*').eq('id', params.planDayId).single(),
      '읽기표 동기화 날짜 조회'
    ),
    withApiTimeout(
      supabase.from('bible_reading_plan_day_items').select('*').eq('plan_day_id', params.planDayId),
      '읽기표 동기화 장 조회'
    ),
  ]);
  if (dayError) throw dayError;
  if (itemsError) throw itemsError;

  const completedItems = (items ?? []).filter(item => item.completed_at);
  const completedCount = completedItems.length;

  const { data: existingLog, error: logLookupError } = await withApiTimeout(
    supabase
      .from('bible_reading_logs')
      .select('*')
      .eq('user_id', plan.owner_user_id)
      .eq('plan_day_id', params.planDayId)
      .eq('source_type', 'plan')
      .maybeSingle(),
    '읽기표 자동 기록 조회'
  );
  if (logLookupError) throw logLookupError;

  if (completedCount === 0) {
    if (existingLog) {
      const { error } = await withApiTimeout(
        supabase.from('bible_reading_logs').delete().eq('id', existingLog.id),
        '읽기표 자동 기록 삭제'
      );
      if (error) throw error;
    }
    const { error: dayUpdateError } = await withApiTimeout(
      supabase.from('bible_reading_plan_days').update({ completed_at: null }).eq('id', params.planDayId),
      '읽기표 날짜 미완료 처리'
    );
    if (dayUpdateError) throw dayUpdateError;
    return;
  }

  const sourceLabel = `${plan.title} ${day.day_number}일차`;
  let readingLogId = existingLog?.id;

  if (existingLog) {
    const { error } = await withApiTimeout(
      supabase
        .from('bible_reading_logs')
        .update({
          chapters: completedCount,
          log_date: day.scheduled_date,
          source_label: sourceLabel,
          plan_id: plan.id,
          plan_day_id: day.id,
        })
        .eq('id', existingLog.id),
      '읽기표 자동 기록 수정'
    );
    if (error) throw error;
  } else {
    const { data: insertedLog, error } = await withApiTimeout(
      supabase
        .from('bible_reading_logs')
        .insert({
          user_id: plan.owner_user_id,
          log_date: day.scheduled_date,
          chapters: completedCount,
          source_type: 'plan',
          source_label: sourceLabel,
          plan_id: plan.id,
          plan_day_id: day.id,
        })
        .select('id')
        .single(),
      '읽기표 자동 기록 생성'
    );
    if (error) throw error;
    readingLogId = insertedLog.id;
  }

  const dayCompletedAt = completedCount === day.chapter_count ? new Date().toISOString() : null;
  const { error: dayUpdateError } = await withApiTimeout(
    supabase.from('bible_reading_plan_days').update({ completed_at: dayCompletedAt }).eq('id', day.id),
    '읽기표 날짜 완료 처리'
  );
  if (dayUpdateError) throw dayUpdateError;

  if (readingLogId) {
    const { error: itemUpdateError } = await withApiTimeout(
      supabase
        .from('bible_reading_plan_day_items')
        .update({ reading_log_id: readingLogId })
        .eq('plan_day_id', day.id)
        .not('completed_at', 'is', null),
      '읽기표 장 자동 기록 연결'
    );
    if (itemUpdateError) throw itemUpdateError;
  }
}

export async function setBiblePlanItemCompleted(params: {
  planId: string;
  planDayId: string;
  itemId: string;
  completed: boolean;
}): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('bible_reading_plan_day_items')
      .update({
        completed_at: params.completed ? new Date().toISOString() : null,
        reading_log_id: null,
      })
      .eq('id', params.itemId),
    '읽기표 장 완료 변경'
  );
  if (error) throw error;
  await syncBiblePlanDayLog({ planId: params.planId, planDayId: params.planDayId });
}

export async function completeBiblePlanDay(params: {
  planId: string;
  planDayId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await withApiTimeout(
    supabase
      .from('bible_reading_plan_day_items')
      .update({ completed_at: now })
      .eq('plan_day_id', params.planDayId)
      .is('completed_at', null),
    '읽기표 하루 분량 완료'
  );
  if (error) throw error;
  await syncBiblePlanDayLog(params);
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
      const ctx = (error as any).context;
      if (ctx) {
        const body = typeof ctx.json === 'function' ? await ctx.json() : ctx;
        if (body?.error) throw new Error(body.error);
      }
    } catch (e) {
      if (e instanceof Error && e.message !== error.message) throw e;
    }
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      throw new Error('로그인 세션이 유효하지 않습니다. 현재 preview에서 다시 로그인한 뒤 시도해주세요.');
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

  if (error) throw error;
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
