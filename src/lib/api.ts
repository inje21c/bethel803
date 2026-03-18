import { supabase } from './supabase';
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

export async function getBibleStudies(): Promise<BibleStudy[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_studies')
      .select('*')
      .eq('published', true)
      .order('study_date', { ascending: false })
      .order('created_at', { ascending: false }),
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
  }));
}

export async function getAllBibleStudies(): Promise<BibleStudy[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_studies')
      .select('*')
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
  }));
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
export async function getStudyAnswersForStudy(studyId: string): Promise<StudyAnswerWithUser[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('study_answers')
      .select('*, users(name)')
      .eq('study_id', studyId)
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

export async function getPrayerRequests(): Promise<PrayerRequest[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('prayer_requests')
      .select('*, users(name)')
      .order('created_at', { ascending: false }),
    '기도제목 조회'
  );
  if (error) throw error;
  return (data ?? []).map(mapPrayerRow);
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

export async function getSharedPrayerRequests(): Promise<PrayerRequest[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('prayer_requests')
      .select('*, users(name)')
      .eq('shared_with_leader', true)
      .order('created_at', { ascending: false }),
    '공유된 기도제목 조회'
  );
  if (error) throw error;
  return (data ?? []).map(mapPrayerRow);
}

export async function getGroupPrayerRequests(): Promise<PrayerRequest[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('prayer_requests')
      .select('*, users(name)')
      .eq('shared_with_group', true)
      .order('created_at', { ascending: false }),
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
    supabase
      .from('bible_reading_logs')
      .select('chapters')
      .eq('user_id', userId),
    '성경읽기 누적 조회'
  );
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + row.chapters, 0);
}

export interface BibleReadingSummary {
  userId: string;
  userName: string;
  totalChapters: number;
}

export async function getAllBibleReadingSummaries(): Promise<BibleReadingSummary[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('bible_reading_logs')
      .select('user_id, chapters, users(name)'),
    '성경읽기 요약 조회'
  );
  if (error) throw error;

  const map = new Map<string, { name: string; total: number }>();
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    const name = (row.users as { name: string } | null)?.name ?? '알 수 없음';
    const existing = map.get(uid);
    if (existing) {
      existing.total += row.chapters as number;
    } else {
      map.set(uid, { name, total: row.chapters as number });
    }
  }
  return Array.from(map.entries()).map(([userId, { name, total }]) => ({
    userId,
    userName: name,
    totalChapters: total,
  })).sort((a, b) => b.totalChapters - a.totalChapters);
}

// ============================================================
// 일정
// ============================================================

export async function getSchedules(): Promise<Schedule[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('schedules')
      .select('*')
      .order('schedule_date', { ascending: true }),
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

export async function getAllUsers(): Promise<FullUser[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('users')
      .select('id, name, role, status, created_at, district_id, districts(name)')
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

export async function getAccessInfo(): Promise<AccessInfo[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('users')
      .select('id, name, last_login_at')
      .eq('status', 'active')
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
export async function getCurrentLockStatus(): Promise<boolean> {
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
      .maybeSingle(),
    '주간 마감 상태 조회'
  );

  return data?.is_locked === true;
}

export async function getWeeklyReports(): Promise<WeeklyReport[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('weekly_reports')
      .select('*')
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
export async function unlockWeeklyReport(weekStart: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase
      .from('weekly_reports')
      .update({ is_locked: false })
      .eq('week_start', weekStart),
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
  id: string;
  title: string;
  pdfUrl: string;
}

/** 주보 PDF를 파싱하여 bible_studies에 등록 (published=false) */
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
    throw error;
  }
  if (!data?.ok) throw new Error(data?.error || '파싱 실패');
  return { id: data.id, title: data.title, pdfUrl: data.pdfUrl };
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
}

/** 오늘(KST) 묵상 조회, 없으면 null */
export async function getTodayDevotional(): Promise<DailyDevotional | null> {
  const now = new Date();
  const today = getKSTDateString(now);

  const { data, error } = await withApiTimeout(
    supabase
      .from('daily_devotionals')
      .select('*')
      .eq('devotional_date', today)
      .maybeSingle(),
    '오늘의 묵상 조회'
  );

  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    date: data.devotional_date,
    verse: data.scripture ?? '',
    content: data.content ?? '',
    summary: data.summary ?? '',
    applicationQuestion: data.application_question ?? null,
    sourceUrl: data.source_url ?? null,
  };
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
}

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await withApiTimeout(
    supabase
      .from('notifications')
      .select('*, notification_reads(user_id)')
      .order('created_at', { ascending: false }),
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

export async function createNotification(params: { title: string; body: string; createdBy: string; districtId: string }): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('notifications').insert({
      title: params.title,
      body: params.body,
      created_by: params.createdBy,
      district_id: params.districtId,
    }),
    '알림 생성'
  );
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await withApiTimeout(
    supabase.from('notifications').delete().eq('id', id),
    '알림 삭제'
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

/** 주어진 날짜의 ISO 주차 번호 */
export function getISOWeekNumber(dateStr: string): number {
  const date = new Date(dateStr);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
