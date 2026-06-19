import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, MapPin, Clock, X, HeartHandshake, BookHeart, Flame, CheckCircle2, Circle, CheckSquare2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useChurch } from '@/lib/churchContext';
import { useDistrict } from '@/lib/districtContext';
import { getBibleStudies, getStudyAnswer, getAttendances, getUpcomingSchedules, getTodayQT, getMyStreak, getMyQTResponse, getKSTDateString, getGroupPrayerRequests, getMyIntercessions, getIntercessionCounts, toggleIntercession, getWeeklyChapterCount, getMyWeeklyPrayerCount, getLeaderWeeklyChecklist, getWeeklyReports } from '@/lib/api';
import type { Attendance } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const { user } = useAuth();
  const { currentDistrictId } = useDistrict();

  const { data: studies = [] } = useQuery({
    queryKey: ['bible_studies', 'dashboard_preview', currentDistrictId],
    queryFn: () => getBibleStudies(currentDistrictId, { limit: 2 }),
    enabled: !!currentDistrictId,
  });

  const recentStudies = studies.slice(0, 2);
  const latestStudy = recentStudies[0];


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

  const otherGroupPrayers = groupPrayers.slice(0, 5);
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

  // "이번 주 내가 한 일" 카드용 쿼리 (구역장/구역원 공통)
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  };

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

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* 인사말 */}
        <div>
          <h1 className="font-display text-2xl font-bold">안녕하세요, {user?.name}님</h1>
          <p className="text-muted-foreground text-sm mt-1">
            이번 주도 은혜로운 한 주 보내세요!{' '}
            <Link to="/manual" className="text-primary hover:underline underline-offset-2">처음이세요?</Link>
          </p>
        </div>

        {/* Trial 배너 */}
        {churchInfo?.isTrialing && churchInfo.trialDaysLeft > 7 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">{churchInfo.trialDaysLeft}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">무료 체험 {churchInfo.trialDaysLeft}일 남음</p>
              <p className="text-xs text-muted-foreground">체험 기간 중 모든 기능을 제한 없이 사용하세요</p>
            </div>
          </div>
        )}
        {churchInfo?.isTrialing && churchInfo.trialDaysLeft > 0 && churchInfo.trialDaysLeft <= 7 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{churchInfo.trialDaysLeft}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">체험 종료 {churchInfo.trialDaysLeft}일 전</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">도입을 원하시면 아래 문의하기로 연락주세요</p>
            </div>
            <Link to="/support" className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline underline-offset-2 shrink-0">
              문의하기
            </Link>
          </div>
        )}
        {churchInfo?.isTrialing && churchInfo.trialDaysLeft === 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">무료 체험 기간이 끝났습니다</p>
              <p className="text-xs text-red-700 dark:text-red-400">지금은 계속 이용하실 수 있습니다. 도입 문의는 아래로 연락주세요</p>
            </div>
            <Link to="/support" className="text-xs font-semibold text-red-800 dark:text-red-300 underline underline-offset-2 shrink-0">
              문의하기
            </Link>
          </div>
        )}

        {/* QT 히어로 카드 */}
        <motion.div variants={item} initial="hidden" animate="show">
          <Link to="/qt" className="block rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
            {qtCompleted ? (
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-200 dark:border-orange-800 p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookHeart className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">오늘의 QT</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <p className="font-display text-lg font-bold text-orange-900 dark:text-orange-100">
                  {currentStreak > 0 ? `🔥 ${currentStreak}일 연속 완료!` : '오늘 묵상 완료!'}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">내일도 함께해요 →</p>
              </div>
            ) : (
              <div className="card-elevated p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookHeart className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">오늘의 QT</span>
                  </div>
                  {currentStreak >= 3 && (
                    <span className="flex items-center gap-1 text-xs text-orange-500 font-semibold bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-full px-2 py-0.5">
                      <Flame className="w-3 h-3" />{currentStreak}일 연속
                    </span>
                  )}
                </div>
                {todayQT.isLoaded ? (
                  <>
                    <p className="font-display font-bold text-base leading-snug mb-1">
                      {todayQt?.title ?? '오늘의 묵상'}
                    </p>
                    <p className="text-xs text-primary font-medium mb-2">{todayQT.verse}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{todayQT.summary}</p>
                    <span className="inline-block mt-3 text-xs text-primary font-semibold">말씀 묵상하기 →</span>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{devotionalLoading ? '불러오는 중...' : '오늘의 말씀이 기다리고 있어요'}</p>
                )}
              </div>
            )}
          </Link>
        </motion.div>

        {/* 섹션: 구역 운영 (구역장 전용) */}
        {isLeader && leaderChecklist && (
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase px-0.5">구역 운영</p>
        )}

        {/* 구역장: 이번 주 할 일 체크리스트 */}
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
                  <h2 className="font-display font-semibold text-sm flex items-center gap-2">
                    <CheckSquare2 className="w-4 h-4 text-primary" /> 이번 주 구역장 할 일
                  </h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${done === total ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {done}/{total} 완료
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {/* 성경공부 등록 */}
                  <Link to="/bible-study" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${leaderChecklist.bibleStudyRegistered ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/40 border-transparent hover:bg-muted/60'}`}>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="text-base leading-none">📖</span>
                      <span className="text-xs text-muted-foreground">성경공부 등록</span>
                    </div>
                    {leaderChecklist.bibleStudyRegistered
                      ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                  </Link>
                  {/* 모임일정 등록 */}
                  <Link to="/schedule" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${leaderChecklist.scheduleRegistered ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/40 border-transparent hover:bg-muted/60'}`}>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="text-base leading-none">📅</span>
                      <span className="text-xs text-muted-foreground">모임일정 등록</span>
                    </div>
                    {leaderChecklist.scheduleRegistered
                      ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                  </Link>
                  {/* QT 배포 확인 */}
                  <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${leaderChecklist.qtExists ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/40 border-transparent'}`}>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="text-base leading-none">✝️</span>
                      <span className="text-xs text-muted-foreground">QT 배포 확인</span>
                    </div>
                    {leaderChecklist.qtExists
                      ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                  </div>
                  {/* 출석 확인 (출석체크 일정이 있는 경우만) */}
                  {leaderChecklist.attendanceScheduleExists && (
                    <Link to="/schedule" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${leaderChecklist.attendanceChecked ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/40 border-transparent hover:bg-muted/60'}`}>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-base leading-none">👥</span>
                        <span className="text-xs text-muted-foreground">출석 확인</span>
                      </div>
                      {leaderChecklist.attendanceChecked
                        ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                    </Link>
                  )}
                </div>
                {/* 진행 바 */}
                <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-500"
                    style={{ width: `${Math.round((done / total) * 100)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })()}


        {/* 섹션: 나의 활동 (구역장에게만 레이블 표시 — 구역원은 레이블 불필요) */}
        {isLeader && (
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase px-0.5">나의 활동</p>
        )}

        {/* 이번 주 내가 한 일 (구역장/구역원 공통) */}
        <motion.div variants={item} initial="hidden" animate="show">
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="font-display font-semibold text-sm flex items-center gap-2">
                <CheckSquare2 className="w-4 h-4 text-primary" /> 이번 주 내가 한 일
              </h2>
              <span className="text-xs text-muted-foreground">{weekDoneCount} / 4 완료</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {/* 성경공부 */}
              <Link to="/bible-study" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${studyDone ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/40 border-transparent'}`}>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-base leading-none">📖</span>
                  <span className="text-xs text-muted-foreground">성경공부</span>
                </div>
                {studyDone
                  ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
              </Link>
              {/* 모임출석 */}
              {attendanceSchedule ? (
                <Link to="/schedule" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${attendanceDone ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/40 border-transparent'}`}>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-base leading-none">📋</span>
                    <span className="text-xs text-muted-foreground">모임출석</span>
                  </div>
                  {attendanceDone
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    : <Circle className="w-5 h-5 text-muted-foreground/25 shrink-0" />}
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-transparent bg-muted/20">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-base leading-none">📋</span>
                    <span className="text-xs text-muted-foreground">모임출석</span>
                  </div>
                  <Circle className="w-5 h-5 text-muted-foreground/15 shrink-0" />
                </div>
              )}
              {/* 성경읽기 */}
              <Link to="/bible-reading" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${weeklyChapters > 0 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/40 border-transparent'}`}>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-base leading-none">📚</span>
                  <span className="text-xs text-muted-foreground">성경읽기</span>
                </div>
                <span className={`text-lg font-bold shrink-0 ${weeklyChapters > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground/30'}`}>{weeklyChapters}</span>
              </Link>
              {/* 기도하기 */}
              <Link to="/prayer-requests" className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${weeklyPrayerCount > 0 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/40 border-transparent'}`}>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-base leading-none">🙏</span>
                  <span className="text-xs text-muted-foreground">기도하기</span>
                </div>
                <span className={`text-lg font-bold shrink-0 ${weeklyPrayerCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground/30'}`}>{weeklyPrayerCount}</span>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* 우리 구역은? — 지난주 주간보고 마감 집계 */}
        {lastLockedReport && (
          <motion.div variants={item} initial="hidden" animate="show">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/40">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">우리 구역은?</span>
              <span className="text-muted-foreground/30 text-xs mx-0.5">|</span>
              <span className="text-xs">📖 성경읽기 {lastLockedReport.bibleChaptersTotal}장</span>
              <span className="text-muted-foreground/30 text-xs">·</span>
              <span className="text-xs">👥 출석 {lastLockedReport.attendanceCount}명</span>
              <span className="text-xs text-muted-foreground/50 ml-auto shrink-0">지난주</span>
            </div>
          </motion.div>
        )}

        {/* 다가오는 일정 */}
        {upcomingSchedules.length > 0 && (
          <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" /> 다가오는 일정
                </h2>
                <Link to="/schedule" className="text-xs text-primary font-medium hover:underline">전체보기 →</Link>
              </div>
              <div className="space-y-3">
                {upcomingSchedules.map(s => (
                  <div key={s.id} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary leading-none">{new Date(s.date).getDate()}</span>
                      <span className="text-[10px] text-primary/70">{['일','월','화','수','목','금','토'][new Date(s.date).getDay()]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate">{s.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {s.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.time}</span>}
                        {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 중보기도 */}
        {otherGroupPrayers.length > 0 && (
          <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.25 }}>
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-primary" /> 구역식구를 위한 중보기도
                </h2>
                <Link to="/prayer-requests" className="text-xs text-primary font-medium hover:underline">전체보기 →</Link>
              </div>
              <div className="space-y-3">
                {otherGroupPrayers.map(p => {
                  const isJoined = myIntercessions.has(p.id);
                  const count = intercessionCounts[p.id] ?? 0;
                  return (
                    <div key={p.id} className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${isJoined ? 'bg-primary/5' : 'bg-muted/50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium">{p.userName}</span>
                          <span className="text-xs text-muted-foreground">{p.createdAt}</span>
                        </div>
                        <p className="text-sm truncate">{p.content}</p>
                        {count > 0 && (
                          <span className="text-xs text-muted-foreground mt-1 block">{count}명이 함께 기도 중</span>
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
                        <span className="text-[10px] text-primary/70">{['일','월','화','수','목','금','토'][new Date(s.date).getDay()]}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold">{s.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
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
