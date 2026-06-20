import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, MapPin, Clock, X, HeartHandshake, BookHeart, Flame,
  CheckCircle2, Circle, CheckSquare2, BookOpen, BookMarked, Users, ClipboardList, Heart,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useChurch } from '@/lib/churchContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getBibleStudies, getStudyAnswer, getAttendances, getUpcomingSchedules,
  getTodayQT, getMyStreak, getMyQTResponse, getKSTDateString,
  getGroupPrayerRequests, getMyIntercessions, getIntercessionCounts, toggleIntercession,
  getWeeklyChapterCount, getMyWeeklyPrayerCount, getLeaderWeeklyChecklist, getWeeklyReports,
  getYearlyChapterCount,
} from '@/lib/api';
import type { Attendance } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';

const LAST_LOCATION_KEY_PREFIX = 'bethel_bible_last_location';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const { user } = useAuth();
  const { currentDistrictId, currentDistrictName } = useDistrict();

  const { data: studies = [] } = useQuery({
    queryKey: ['bible_studies', 'dashboard_preview', currentDistrictId],
    queryFn: () => getBibleStudies(currentDistrictId, { limit: 2 }),
    enabled: !!currentDistrictId,
  });

  const latestStudy = studies[0];

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', 'upcoming', currentDistrictId],
    queryFn: () => getUpcomingSchedules(currentDistrictId, 3),
    enabled: !!currentDistrictId,
  });

  const today = getKSTDateString(new Date());
  const { data: todayQt, isLoading: devotionalLoading } = useQuery({
    queryKey: ['qt_content', today],
    queryFn: getTodayQT,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data ? false : 60_000),
  });

  const { data: streak } = useQuery({
    queryKey: ['streak', user?.id],
    queryFn: () => getMyStreak(user!.id),
    enabled: !!user?.id,
  });

  const { data: myQTResponse } = useQuery({
    queryKey: ['qt_response', todayQt?.id, user?.id],
    queryFn: () => getMyQTResponse(todayQt!.id, user!.id),
    enabled: !!todayQt?.id && !!user?.id,
  });

  const { data: groupPrayers = [] } = useQuery({
    queryKey: ['group_prayer_requests', 'dashboard_preview', currentDistrictId],
    queryFn: () => getGroupPrayerRequests(currentDistrictId, { limit: 5 }),
    enabled: !!currentDistrictId,
  });

  const groupPrayerIds = useMemo(() => groupPrayers.map(p => p.id), [groupPrayers]);

  const { data: myIntercessions = new Set<string>() } = useQuery({
    queryKey: ['my_intercessions', user?.id],
    queryFn: () => getMyIntercessions(user!.id),
    enabled: !!user,
  });

  const { data: intercessionCounts = {} } = useQuery({
    queryKey: ['intercession_counts', groupPrayerIds],
    queryFn: () => getIntercessionCounts(groupPrayerIds),
    enabled: groupPrayerIds.length > 0,
  });

  const { settings: churchInfo } = useChurch();
  const isLeader = user?.role === 'leader' || user?.role === 'master';

  const { data: latestAnswer } = useQuery({
    queryKey: ['study_answer_dashboard', latestStudy?.id, user?.id],
    queryFn: () => getStudyAnswer(latestStudy!.id, user!.id),
    enabled: !!latestStudy && !!user,
  });
  const { data: weeklyChapters = 0 } = useQuery({
    queryKey: ['weekly_chapters', user?.id],
    queryFn: () => getWeeklyChapterCount(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const { data: weeklyPrayerCount = 0 } = useQuery({
    queryKey: ['weekly_prayer_count', user?.id],
    queryFn: () => getMyWeeklyPrayerCount(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const currentYear = new Date().getFullYear();
  const { data: yearlyChapters = 0 } = useQuery({
    queryKey: ['yearly_chapters', user?.id, currentYear],
    queryFn: () => getYearlyChapterCount(user!.id, currentYear),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  const attendanceSchedule = schedules.find(s => s.attendanceCheck);
  const { data: attendances = [] } = useQuery({
    queryKey: ['attendances_todo', attendanceSchedule?.id],
    queryFn: () => getAttendances(attendanceSchedule!.id),
    enabled: !!attendanceSchedule?.id,
  });
  const myAttendance = (attendances as Attendance[]).find(a => a.userId === user?.id);
  const attendanceDone = !!myAttendance && myAttendance.status !== 'pending';
  const studyDone = latestAnswer?.completed ?? false;
  const weekDoneCount = [studyDone, attendanceDone, weeklyChapters > 0, weeklyPrayerCount > 0].filter(Boolean).length;

  const { data: leaderChecklist } = useQuery({
    queryKey: ['leader_checklist', currentDistrictId],
    queryFn: () => getLeaderWeeklyChecklist(currentDistrictId),
    enabled: isLeader && !!currentDistrictId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: weeklyReports = [] } = useQuery({
    queryKey: ['weekly_reports', currentDistrictId],
    queryFn: () => getWeeklyReports(currentDistrictId),
    enabled: !!currentDistrictId,
    staleTime: 1000 * 60 * 10,
  });
  const lastLockedReport = weeklyReports.find(r => r.isLocked);

  const queryClient = useQueryClient();
  const intercessionMutation = useMutation({
    mutationFn: (prayerRequestId: string) => toggleIntercession(prayerRequestId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_intercessions'] });
      queryClient.invalidateQueries({ queryKey: ['intercession_counts'] });
    },
  });

  const upcomingSchedules = schedules;
  const qtCompleted = myQTResponse?.isCompleted === true;
  const currentStreak = streak?.currentStreak ?? 0;

  const [showPopup, setShowPopup] = useState(false);
  useEffect(() => {
    const now = new Date();
    const popupKey = `bethel-popup-${now.toISOString().split('T')[0]}`;
    if (upcomingSchedules.length > 0 && !sessionStorage.getItem(popupKey)) {
      setShowPopup(true);
      sessionStorage.setItem(popupKey, '1');
    }
  }, [upcomingSchedules.length]);

  // 마지막 성경읽기 위치 (localStorage)
  const [hasBibleLocation, setHasBibleLocation] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`${LAST_LOCATION_KEY_PREFIX}:${user.id}`);
      setHasBibleLocation(!!raw);
    } catch {}
  }, [user?.id]);

  const todayQT = useMemo(() => {
    if (todayQt) {
      return {
        verse: todayQt.scripture ?? '',
        summary: todayQt.summary ?? todayQt.question ?? '',
        isLoaded: true,
      };
    }
    return {
      verse: '매일 06:00 업데이트',
      summary: devotionalLoading ? '불러오는 중...' : '오늘의 묵상이 아직 준비되지 않았습니다.',
      isLoaded: false,
    };
  }, [todayQt, devotionalLoading]);

  const bibleProgress = Math.min(Math.round((yearlyChapters / 1189) * 100), 100);

  const nearestSchedule = upcomingSchedules[0];
  const attendingCount = (attendances as Attendance[]).filter(a => a.status === 'attending').length;
  const totalMembers = (attendances as Attendance[]).length;

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* 인사 헤더 */}
        <div>
          <p className="text-[13px] text-muted-foreground font-medium">{currentDistrictName}</p>
          <h1 className="font-display text-2xl font-bold">안녕하세요, {user?.name}님</h1>
        </div>

        {/* Trial 배너 */}
        {churchInfo?.isTrialing && churchInfo.trialDaysLeft > 7 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">{churchInfo.trialDaysLeft}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold">무료 체험 {churchInfo.trialDaysLeft}일 남음</p>
              <p className="text-[13px] text-muted-foreground">체험 기간 중 모든 기능을 제한 없이 사용하세요</p>
            </div>
          </div>
        )}
        {churchInfo?.isTrialing && churchInfo.trialDaysLeft > 0 && churchInfo.trialDaysLeft <= 7 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{churchInfo.trialDaysLeft}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-amber-800 dark:text-amber-300">체험 종료 {churchInfo.trialDaysLeft}일 전</p>
              <p className="text-[13px] text-amber-700 dark:text-amber-400">도입을 원하시면 아래 문의하기로 연락주세요</p>
            </div>
            <Link to="/support" className="text-[13px] font-semibold text-amber-800 dark:text-amber-300 underline underline-offset-2 shrink-0">
              문의하기
            </Link>
          </div>
        )}
        {churchInfo?.isTrialing && churchInfo.trialDaysLeft === 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-red-800 dark:text-red-300">무료 체험 기간이 끝났습니다</p>
              <p className="text-[13px] text-red-700 dark:text-red-400">지금은 계속 이용하실 수 있습니다. 도입 문의는 아래로 연락주세요</p>
            </div>
            <Link to="/support" className="text-[13px] font-semibold text-red-800 dark:text-red-300 underline underline-offset-2 shrink-0">
              문의하기
            </Link>
          </div>
        )}

        {/* ─── 섹션: 나의 신앙생활 ─── */}
        <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase px-0.5">나의 신앙생활</p>

        {/* QT 히어로 카드 */}
        <motion.div variants={item} initial="hidden" animate="show">
          <Link to="/qt" className="block rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
            {qtCompleted ? (
              <div className="bg-primary p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookHeart className="w-4 h-4 text-primary-foreground/80" />
                    <span className="text-[13px] font-semibold text-primary-foreground/80">오늘의 QT</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <p className="font-display text-lg font-bold text-primary-foreground">
                  {currentStreak > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-5 h-5 text-accent" />{currentStreak}일 연속 완료!
                    </span>
                  ) : '오늘 묵상 완료!'}
                </p>
                <p className="text-[13px] text-primary-foreground/70 mt-1">내일도 함께해요 →</p>
              </div>
            ) : (
              <div className="bg-primary p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookHeart className="w-4 h-4 text-primary-foreground/80" />
                    <span className="text-[13px] font-semibold text-primary-foreground/80">오늘의 QT</span>
                  </div>
                  {currentStreak >= 3 && (
                    <span className="flex items-center gap-1 text-[13px] text-accent font-semibold bg-primary-foreground/10 rounded-full px-2 py-0.5">
                      <Flame className="w-3 h-3" />{currentStreak}일 연속
                    </span>
                  )}
                </div>
                {todayQT.isLoaded ? (
                  <>
                    <p className="font-display font-bold text-[15px] leading-snug mb-1 text-primary-foreground">
                      {todayQt?.title ?? '오늘의 묵상'}
                    </p>
                    <p className="text-[13px] text-accent font-medium mb-2">{todayQT.verse}</p>
                    <p className="text-[13px] text-primary-foreground/70 leading-relaxed line-clamp-2">{todayQT.summary}</p>
                  </>
                ) : (
                  <p className="text-[15px] text-primary-foreground/70">{devotionalLoading ? '불러오는 중...' : '오늘의 말씀이 기다리고 있어요'}</p>
                )}
                <div className="mt-4">
                  <span className="inline-flex items-center px-4 py-2 rounded-xl bg-accent text-accent-foreground text-[13px] font-semibold">
                    QT 시작하기 →
                  </span>
                </div>
              </div>
            )}
          </Link>
        </motion.div>

        {/* 나의 성경읽기 */}
        <motion.div variants={item} initial="hidden" animate="show">
          <Link to="/bible-reading" className="block card-elevated p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-primary" /> 나의 성경읽기
              </h2>
              <span className="text-[13px] text-primary font-semibold">
                {hasBibleLocation ? '이어 읽기 →' : '시작하기 →'}
              </span>
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] text-muted-foreground">올해 {yearlyChapters}장 읽음</span>
              <span className="text-[13px] text-muted-foreground">{yearlyChapters} / 1189장</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${bibleProgress}%` }}
              />
            </div>
          </Link>
        </motion.div>

        {/* 이번 주 내가 한 일 */}
        <motion.div variants={item} initial="hidden" animate="show">
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
                <CheckSquare2 className="w-4 h-4 text-primary" /> 이번 주 내가 한 일
              </h2>
              <span className="text-[13px] text-muted-foreground">{weekDoneCount} / 4</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Link to="/bible-study" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${studyDone ? 'bg-success/10 border-success/30' : 'bg-muted/40 border-transparent'}`}>
                <BookOpen className={`w-4 h-4 shrink-0 ${studyDone ? 'text-success' : 'text-muted-foreground/50'}`} />
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-[13px] text-muted-foreground">성경공부</span>
                </div>
                {studyDone ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
              </Link>

              {attendanceSchedule ? (
                <Link to="/schedule" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${attendanceDone ? 'bg-success/10 border-success/30' : 'bg-muted/40 border-transparent'}`}>
                  <ClipboardList className={`w-4 h-4 shrink-0 ${attendanceDone ? 'text-success' : 'text-muted-foreground/50'}`} />
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-[13px] text-muted-foreground">모임출석</span>
                  </div>
                  {attendanceDone ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-transparent bg-muted/20">
                  <ClipboardList className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                  <span className="text-[13px] text-muted-foreground/50">모임출석</span>
                  <Circle className="w-5 h-5 text-muted-foreground/15 shrink-0 ml-auto" />
                </div>
              )}

              <Link to="/bible-reading" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${weeklyChapters > 0 ? 'bg-success/10 border-success/30' : 'bg-muted/40 border-transparent'}`}>
                <BookMarked className={`w-4 h-4 shrink-0 ${weeklyChapters > 0 ? 'text-success' : 'text-muted-foreground/50'}`} />
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-[13px] text-muted-foreground">성경읽기</span>
                </div>
                <span className={`text-base font-bold shrink-0 ${weeklyChapters > 0 ? 'text-success' : 'text-muted-foreground/30'}`}>{weeklyChapters}</span>
              </Link>

              <Link to="/prayer-requests" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${weeklyPrayerCount > 0 ? 'bg-success/10 border-success/30' : 'bg-muted/40 border-transparent'}`}>
                <Heart className={`w-4 h-4 shrink-0 ${weeklyPrayerCount > 0 ? 'text-success' : 'text-muted-foreground/50'}`} />
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-[13px] text-muted-foreground">기도하기</span>
                </div>
                <span className={`text-base font-bold shrink-0 ${weeklyPrayerCount > 0 ? 'text-success' : 'text-muted-foreground/30'}`}>{weeklyPrayerCount}</span>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ─── 섹션: 구역 운영 (구역장 전용) ─── */}
        {isLeader && leaderChecklist && (
          <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase px-0.5">구역 운영</p>
        )}

        {isLeader && leaderChecklist && (() => {
          const items = [
            leaderChecklist.bibleStudyRegistered,
            leaderChecklist.scheduleRegistered,
            leaderChecklist.qtExists,
            ...(leaderChecklist.attendanceScheduleExists ? [leaderChecklist.attendanceChecked] : []),
          ];
          const total = items.length;
          const done = items.filter(Boolean).length;
          return (
            <motion.div variants={item} initial="hidden" animate="show">
              <div className="card-elevated p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
                    <CheckSquare2 className="w-4 h-4 text-primary" /> 이번 주 할 일
                  </h2>
                  <span className={`text-[13px] font-semibold px-2 py-0.5 rounded-full ${done === total ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                    {done}/{total} 완료
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Link to="/bible-study" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${leaderChecklist.bibleStudyRegistered ? 'bg-success/10 border-success/30' : 'bg-muted/40 border-transparent hover:bg-muted/60'}`}>
                    <BookOpen className={`w-4 h-4 shrink-0 ${leaderChecklist.bibleStudyRegistered ? 'text-success' : 'text-muted-foreground/50'}`} />
                    <span className="text-[13px] text-muted-foreground flex-1">성경공부 등록</span>
                    {leaderChecklist.bibleStudyRegistered ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                  </Link>
                  <Link to="/schedule" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${leaderChecklist.scheduleRegistered ? 'bg-success/10 border-success/30' : 'bg-muted/40 border-transparent hover:bg-muted/60'}`}>
                    <CalendarDays className={`w-4 h-4 shrink-0 ${leaderChecklist.scheduleRegistered ? 'text-success' : 'text-muted-foreground/50'}`} />
                    <span className="text-[13px] text-muted-foreground flex-1">일정 등록</span>
                    {leaderChecklist.scheduleRegistered ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                  </Link>
                  <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${leaderChecklist.qtExists ? 'bg-success/10 border-success/30' : 'bg-muted/40 border-transparent'}`}>
                    <BookHeart className={`w-4 h-4 shrink-0 ${leaderChecklist.qtExists ? 'text-success' : 'text-muted-foreground/50'}`} />
                    <span className="text-[13px] text-muted-foreground flex-1">QT 배포 확인</span>
                    {leaderChecklist.qtExists ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                  </div>
                  {leaderChecklist.attendanceScheduleExists && (
                    <Link to="/schedule" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${leaderChecklist.attendanceChecked ? 'bg-success/10 border-success/30' : 'bg-muted/40 border-transparent hover:bg-muted/60'}`}>
                      <Users className={`w-4 h-4 shrink-0 ${leaderChecklist.attendanceChecked ? 'text-success' : 'text-muted-foreground/50'}`} />
                      <span className="text-[13px] text-muted-foreground flex-1">출석 확인</span>
                      {leaderChecklist.attendanceChecked ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                    </Link>
                  )}
                </div>
                <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-500"
                    style={{ width: `${Math.round((done / total) * 100)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* 우리 구역 이번 주 통계 */}
        {lastLockedReport && (
          <motion.div variants={item} initial="hidden" animate="show">
            <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase px-0.5 mb-2">우리 구역 이번 주</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="card-elevated p-4 text-center">
                <BookMarked className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="font-display text-2xl font-bold text-primary">{lastLockedReport.bibleChaptersTotal}</p>
                <p className="text-[13px] text-muted-foreground">성경읽기(장)</p>
              </div>
              <div className="card-elevated p-4 text-center">
                <Users className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="font-display text-2xl font-bold text-primary">{lastLockedReport.attendanceCount}</p>
                <p className="text-[13px] text-muted-foreground">출석(명)</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 다가오는 일정 */}
        {upcomingSchedules.length > 0 && (
          <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" /> 다가오는 일정
                </h2>
                <Link to="/schedule" className="text-[13px] text-primary font-medium hover:underline">전체보기 →</Link>
              </div>
              <div className="space-y-3">
                {upcomingSchedules.slice(0, 1).map(s => (
                  <div key={s.id} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary leading-none">{new Date(s.date).getDate()}</span>
                      <span className="text-xs text-primary/70">{['일','월','화','수','목','금','토'][new Date(s.date).getDay()]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] font-semibold truncate">{s.title}</h4>
                      <div className="flex items-center gap-3 text-[13px] text-muted-foreground mt-0.5">
                        {s.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.time}</span>}
                        {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
                      </div>
                    </div>
                    {s.attendanceCheck && totalMembers > 0 && (
                      <span className="shrink-0 text-[13px] font-semibold text-success bg-success/10 rounded-full px-2 py-0.5">
                        {attendingCount}/{totalMembers}명
                      </span>
                    )}
                  </div>
                ))}
                {upcomingSchedules.length > 1 && (
                  <div className="space-y-2 pt-1">
                    {upcomingSchedules.slice(1).map(s => (
                      <div key={s.id} className="flex items-center gap-3 text-[13px] text-muted-foreground">
                        <span className="w-10 text-center font-medium">{new Date(s.date).getMonth()+1}/{new Date(s.date).getDate()}</span>
                        <span className="truncate">{s.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 중보기도 */}
        {groupPrayers.length > 0 && (
          <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.25 }}>
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold text-[15px] flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-primary" /> 구역식구를 위한 중보기도
                </h2>
                <Link to="/prayer-requests" className="text-[13px] text-primary font-medium hover:underline">전체보기 →</Link>
              </div>
              <div className="space-y-3">
                {groupPrayers.map(p => {
                  const isJoined = myIntercessions.has(p.id);
                  const count = intercessionCounts[p.id] ?? 0;
                  return (
                    <div key={p.id} className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${isJoined ? 'bg-primary/5' : 'bg-muted/50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-medium">{p.userName}</span>
                          <span className="text-[13px] text-muted-foreground">{p.createdAt}</span>
                        </div>
                        <p className="text-[15px] truncate">{p.content}</p>
                        {count > 0 && (
                          <span className="text-[13px] text-muted-foreground mt-1 block">{count}명이 함께 기도 중</span>
                        )}
                      </div>
                      <button
                        onClick={() => intercessionMutation.mutate(p.id)}
                        disabled={intercessionMutation.isPending}
                        className={`shrink-0 p-2 rounded-full transition-colors ${isJoined ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
                        title={isJoined ? '함께 기도 중' : '함께 기도합니다'}
                      >
                        <HeartHandshake className={`w-5 h-5 ${isJoined ? 'fill-primary/20' : ''}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Schedule popup */}
        <AnimatePresence>
          {showPopup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              onClick={() => setShowPopup(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl border p-6 w-full max-w-sm space-y-4"
                style={{ boxShadow: 'var(--shadow-elevated)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-primary" /> 다가오는 일정
                  </h3>
                  <button onClick={() => setShowPopup(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  {upcomingSchedules.map(s => (
                    <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary leading-none">{new Date(s.date).getDate()}</span>
                        <span className="text-xs text-primary/70">{['일','월','화','수','목','금','토'][new Date(s.date).getDay()]}</span>
                      </div>
                      <div>
                        <h4 className="text-[15px] font-semibold">{s.title}</h4>
                        <div className="flex items-center gap-2 text-[13px] text-muted-foreground mt-0.5">
                          {s.time && <span>{s.time}</span>}
                          {s.location && <span>· {s.location}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/schedule" onClick={() => setShowPopup(false)}>
                  <Button variant="outline" className="w-full">일정 전체보기</Button>
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
