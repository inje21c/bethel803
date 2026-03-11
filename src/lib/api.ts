import { supabase } from './supabase';

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
  createdAt: string;
  updatedAt: string;
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
  role: 'leader' | 'member';
  status: 'pending' | 'active';
  createdAt: string;
}

// ============================================================
// 성경공부
// ============================================================

export async function getBibleStudies(): Promise<BibleStudy[]> {
  const { data, error } = await supabase
    .from('bible_studies')
    .select('*')
    .eq('published', true)
    .order('study_date', { ascending: false });
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
  const { data, error } = await supabase
    .from('bible_studies')
    .select('*')
    .order('study_date', { ascending: false });
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
}): Promise<void> {
  const { error } = await supabase.from('bible_studies').insert({
    week_number: params.weekNumber,
    study_date: params.date,
    title: params.title,
    scripture: params.scripture,
    introduction: params.introduction,
    questions: params.questions,
    published: params.published,
  });
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
  const { error } = await supabase
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
    .eq('id', params.id);
  if (error) throw error;
}

export async function deleteBibleStudy(id: string): Promise<void> {
  const { error } = await supabase.from('bible_studies').delete().eq('id', id);
  if (error) throw error;
}

export async function getStudyAnswer(studyId: string, userId: string): Promise<StudyAnswer | null> {
  const { data, error } = await supabase
    .from('study_answers')
    .select('*')
    .eq('study_id', studyId)
    .eq('user_id', userId)
    .maybeSingle();
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
  const { error } = await supabase
    .from('study_answers')
    .upsert(
      {
        study_id: params.studyId,
        user_id: params.userId,
        answers: params.answers,
        completed: params.completed,
      },
      { onConflict: 'study_id,user_id' }
    );
  if (error) throw error;
}

// ============================================================
// 기도제목
// ============================================================

export async function getPrayerRequests(): Promise<PrayerRequest[]> {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*, users(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    userId: row.user_id,
    userName: (row.users as { name: string } | null)?.name ?? '알 수 없음',
    content: row.content,
    response: row.response ?? '',
    answered: row.answered,
    createdAt: row.created_at.slice(0, 10),
    updatedAt: row.updated_at.slice(0, 10),
  }));
}

export async function savePrayerRequest(params: {
  userId: string;
  content: string;
}): Promise<void> {
  const { error } = await supabase.from('prayer_requests').insert({
    user_id: params.userId,
    content: params.content,
  });
  if (error) throw error;
}

export async function updatePrayerRequest(params: {
  id: string;
  response?: string;
  answered?: boolean;
}): Promise<void> {
  const update: Record<string, unknown> = {};
  if (params.response !== undefined) update.response = params.response;
  if (params.answered !== undefined) update.answered = params.answered;
  const { error } = await supabase.from('prayer_requests').update(update).eq('id', params.id);
  if (error) throw error;
}

// ============================================================
// 성경읽기
// ============================================================

export async function getBibleReadingLogs(userId: string): Promise<BibleReadingLog[]> {
  const { data, error } = await supabase
    .from('bible_reading_logs')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false });
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
  const { error } = await supabase.from('bible_reading_logs').insert({
    user_id: params.userId,
    log_date: params.date,
    chapters: params.chapters,
  });
  if (error) throw error;
}

export async function getTotalChapters(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('bible_reading_logs')
    .select('chapters')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + row.chapters, 0);
}

export interface BibleReadingSummary {
  userId: string;
  userName: string;
  totalChapters: number;
}

export async function getAllBibleReadingSummaries(): Promise<BibleReadingSummary[]> {
  const { data, error } = await supabase
    .from('bible_reading_logs')
    .select('user_id, chapters, users(name)');
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
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order('schedule_date', { ascending: true });
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
}): Promise<void> {
  const { error } = await supabase.from('schedules').insert({
    title: params.title,
    schedule_date: params.date,
    schedule_time: params.time || null,
    location: params.location || null,
    memo: params.memo || null,
    attachment: params.attachment || null,
    attendance_check: params.attendanceCheck,
    created_by: params.createdBy,
  });
  if (error) throw error;
}

export async function updateSchedule(schedule: Schedule): Promise<void> {
  const { error } = await supabase
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
    .eq('id', schedule.id);
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('schedules').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// 출석
// ============================================================

export async function getAttendances(scheduleId: string): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendances')
    .select('*, users(name)')
    .eq('schedule_id', scheduleId);
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
  const { error } = await supabase
    .from('attendances')
    .upsert(
      {
        schedule_id: params.scheduleId,
        user_id: params.userId,
        status: params.status,
      },
      { onConflict: 'schedule_id,user_id' }
    );
  if (error) throw error;
}

// ============================================================
// 사용자 관리 (구역장 전용)
// ============================================================

export async function getAllUsers(): Promise<FullUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, status, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at.slice(0, 10),
  }));
}

export async function approveUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ status: 'active' })
    .eq('id', userId);
  if (error) throw error;
}

export async function rejectUser(userId: string): Promise<void> {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw error;
}

export async function changeUserRole(userId: string, role: 'leader' | 'member'): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateUserName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('users').update({ name }).eq('id', userId);
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
  const { data, error } = await supabase
    .from('users')
    .select('id, name, last_login_at')
    .eq('status', 'active')
    .order('last_login_at', { ascending: false, nullsFirst: false });
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

  const { data } = await supabase
    .from('weekly_reports')
    .select('is_locked')
    .eq('week_start', weekStart)
    .maybeSingle();

  return data?.is_locked === true;
}

export async function getWeeklyReports(): Promise<WeeklyReport[]> {
  const { data, error } = await supabase
    .from('weekly_reports')
    .select('*')
    .order('week_start', { ascending: false });
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
  const { error } = await supabase
    .from('weekly_reports')
    .update({ is_locked: false })
    .eq('week_start', weekStart);
  if (error) throw error;
}

/** 현재 주 마감 집계 (구역장 전용, DB RPC 호출) */
export async function triggerWeeklyClose(weekStart?: string): Promise<WeeklyReport> {
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
  const { data, error } = await Promise.race([
    supabase.rpc('compute_weekly_report', { p_week_start: ws }),
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
    setTimeout(() => reject(new Error('요청 시간이 초과되었습니다 (30초)')), 30000)
  );
  const request = supabase.functions.invoke('parse-bulletin', {
    body: pdfUrl ? { pdf_url: pdfUrl } : {},
  });
  const { data, error } = await Promise.race([request, timeout]);
  if (error) throw error;
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
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('daily_devotionals')
    .select('*')
    .eq('devotional_date', today)
    .maybeSingle();

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
  const { data, error } = await supabase
    .from('notifications')
    .select('*, notification_reads(user_id)')
    .order('created_at', { ascending: false });
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
  const { error } = await supabase
    .from('notification_reads')
    .upsert({ notification_id: notificationId, user_id: userId });
  if (error) throw error;
}

export async function createNotification(params: { title: string; body: string; createdBy: string }): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    title: params.title,
    body: params.body,
    created_by: params.createdBy,
  });
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// Phase 7-1: 파일 업로드 (Supabase Storage)
// ============================================================

/** 일정 첨부파일을 Supabase Storage 'attachments' 버킷에 업로드하고 공개 URL 반환 */
export async function uploadScheduleAttachment(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('attachments')
    .upload(fileName, file, { upsert: false });
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
