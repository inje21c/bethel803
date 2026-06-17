import { useMemo, useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, BookMarked, MessageSquareHeart, CheckCircle2, Circle, CalendarDays, MapPin, Clock, X, HeartHandshake, HelpCircle, BookHeart, Flame, Megaphone, ChevronRight, Bell, BookOpenCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useChurch } from '@/lib/churchContext';
import { useDistrict } from '@/lib/districtContext';
import { getBibleStudies, getStudyAnswer, getUnansweredPrayerCount, getTotalChapters, getUpcomingSchedules, getTodayQT, getMyStreak, getMyQTResponse, getKSTDateString, getGroupPrayerRequests, getMyIntercessions, getIntercessionCounts, toggleIntercession, getActiveMemberCount, hasEverDoneQT, getWeeklyReports, hasEverPostedPrayer, hasEverAnsweredStudy } from '@/lib/api';
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

  const { data: latestAnswer } = useQuery({
    queryKey: ['study_answer', latestStudy?.id, user?.id],
    queryFn: () => getStudyAnswer(latestStudy!.id, user!.id),
    enabled: !!latestStudy && !!user,
  });

  const { data: unansweredPrayerCount = 0 } = useQuery({
    queryKey: ['prayer_requests', 'unanswered_count', currentDistrictId],
    queryFn: () => getUnansweredPrayerCount(currentDistrictId),
    enabled: !!currentDistrictId,
  });

  const { data: totalChapters = 0 } = useQuery({
    queryKey: ['total_chapters', user?.id],
    queryFn: () => getTotalChapters(user!.id),
    enabled: !!user,
  });

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

  const { settings: churchInfo, uiMode } = useChurch();
  const isSimple = uiMode === 'simple';
  const isLeader = user?.role === 'leader' || user?.role === 'master';
  const isMember = user?.role === 'member';
  const showGuide = isSimple && (isLeader || isMember);

  // localStorage 키를 userId로 구분 — 같은 브라우저에서 계정 전환 시 혼용 방지
  const uid = user?.id ?? 'anon';

  // 이번 주 모임 공지 완료 여부 — localStorage 주간 플래그
  const thisISOWeek = useMemo(() => {
    const d = new Date();
    const day = d.getDay() === 0 ? 7 : d.getDay();
    const thu = new Date(d);
    thu.setDate(d.getDate() - day + 4);
    const yearStart = new Date(thu.getFullYear(), 0, 1);
    const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${thu.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }, []);
  const noticeKey = `bethel_notice_done_${uid}_${thisISOWeek}`;
  const [noticeDone, setNoticeDone] = useState(() => !!localStorage.getItem(noticeKey));

  const { data: activeMemberCount = 0 } = useQuery({
    queryKey: ['active_member_count', currentDistrictId],
    queryFn: () => getActiveMemberCount(currentDistrictId),
    enabled: showGuide && !!currentDistrictId,
    staleTime: 1000 * 60 * 5,
  });

  // 가이드 phase — 1: 기본 기능 / 2: 심화 기능 탐색
  // 가이드 phase 1→2→3 순차 전환 (userId별 localStorage)
  const [guidePhase] = useState<1 | 2 | 3>(() => {
    if (localStorage.getItem(`bethel_guide_phase2_done_${uid}`)) return 3;
    if (localStorage.getItem(`bethel_guide_phase1_done_${uid}`)) return 2;
    return 1;
  });

  // phase 2 감지 쿼리 (phase2 진입 시에만 실행)
  const { data: qtEverDone = false } = useQuery({
    queryKey: ['qt_ever_done', user?.id],
    queryFn: () => hasEverDoneQT(user!.id),
    enabled: showGuide && guidePhase === 2 && !!user,
    staleTime: 1000 * 60 * 5,
  });
  const { data: weeklyReportList = [] } = useQuery({
    queryKey: ['weekly_reports', currentDistrictId],
    queryFn: () => getWeeklyReports(currentDistrictId),
    enabled: showGuide && guidePhase === 2 && !!currentDistrictId,
    staleTime: 1000 * 60 * 5,
  });
  const [notifDone, setNotifDone] = useState(() =>
    !!localStorage.getItem(`bethel_notifications_setup_done_${uid}`)
  );

  // phase 3 감지 쿼리
  const { data: myIntercessions } = useQuery({
    queryKey: ['my_intercessions', user?.id],
    queryFn: () => getMyIntercessions(user!.id),
    enabled: showGuide && guidePhase === 3 && !!user,
    staleTime: 1000 * 60 * 5,
  });
  const { data: bibleStudies = [] } = useQuery({
    queryKey: ['bible_studies', currentDistrictId],
    queryFn: () => getBibleStudies(currentDistrictId),
    enabled: showGuide && guidePhase === 3 && !!currentDistrictId,
    staleTime: 1000 * 60 * 5,
  });
  const [qtDashboardDone, setQtDashboardDone] = useState(() =>
    !!localStorage.getItem(`bethel_qt_dashboard_done_${uid}`)
  );
  const [attendanceDone, setAttendanceDone] = useState(() =>
    !!localStorage.getItem(`bethel_attendance_done_${uid}`)
  );

  // 구역원 가이드 phase
  const [memberGuidePhase] = useState<1 | 2>(() =>
    localStorage.getItem(`bethel_member_guide_phase1_done_${uid}`) ? 2 : 1
  );

  // 구역원 phase 1 감지
  const { data: memberQtDone = false } = useQuery({
    queryKey: ['qt_ever_done', user?.id],
    queryFn: () => hasEverDoneQT(user!.id),
    enabled: showGuide && isMember && !!user,
    staleTime: 1000 * 60 * 5,
  });
  const { data: memberPrayerDone = false } = useQuery({
    queryKey: ['ever_posted_prayer', user?.id],
    queryFn: () => hasEverPostedPrayer(user!.id),
    enabled: showGuide && isMember && !!user,
    staleTime: 1000 * 60 * 5,
  });
  const { data: memberStudyAnswerDone = false } = useQuery({
    queryKey: ['ever_answered_study', user?.id],
    queryFn: () => hasEverAnsweredStudy(user!.id),
    enabled: showGuide && isMember && !!user,
    staleTime: 1000 * 60 * 5,
  });

  // 구역원 phase 2 감지
  const { data: memberIntercessions } = useQuery({
    queryKey: ['my_intercessions_member', user?.id],
    queryFn: () => getMyIntercessions(user!.id),
    enabled: showGuide && isMember && memberGuidePhase === 2 && !!user,
    staleTime: 1000 * 60 * 5,
  });
  const [memberNotifDone, setMemberNotifDone] = useState(() =>
    !!localStorage.getItem(`bethel_notifications_setup_done_${uid}`)
  );
  const [memberQtShareDone, setMemberQtShareDone] = useState(() =>
    !!localStorage.getItem(`bethel_qt_share_done_${uid}`)
  );

  const queryClient = useQueryClient();
  const intercessionMutation = useMutation({
    mutationFn: (prayerRequestId: string) => toggleIntercession(prayerRequestId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_intercessions'] });
      queryClient.invalidateQueries({ queryKey: ['intercession_counts'] });
    },
  });

  const studyCompleted = latestAnswer?.completed ?? false;
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
          <p className="text-muted-foreground text-sm mt-1">이번 주도 은혜로운 한 주 보내세요!</p>
        </div>

        {/* 이번 주 할 일 — simple 모드 구역장 전용 가이드 */}
        {showGuide && <WeeklyGuideCard
          uid={uid}
          isLeader={isLeader}
          // 구역장 props
          guidePhase={guidePhase}
          activeMemberCount={activeMemberCount}
          noticeDone={noticeDone}
          noticeKey={noticeKey}
          setNoticeDone={setNoticeDone}
          groupPrayersCount={groupPrayers.length}
          schedulesCount={schedules.length}
          qtEverDone={qtEverDone}
          totalChapters={totalChapters}
          weeklyReportCount={weeklyReportList.length}
          notifDone={notifDone}
          setNotifDone={setNotifDone}
          intercessionDone={(myIntercessions?.size ?? 0) > 0}
          bibleStudyExists={bibleStudies.length > 0}
          qtDashboardDone={qtDashboardDone}
          setQtDashboardDone={setQtDashboardDone}
          attendanceDone={attendanceDone}
          setAttendanceDone={setAttendanceDone}
          // 구역원 props
          memberGuidePhase={memberGuidePhase}
          memberQtDone={memberQtDone}
          memberPrayerDone={memberPrayerDone}
          memberBibleDone={totalChapters > 0}
          memberStudyAnswerDone={memberStudyAnswerDone}
          memberIntercessionDone={(memberIntercessions?.size ?? 0) > 0}
          memberNotifDone={memberNotifDone}
          setMemberNotifDone={setMemberNotifDone}
          memberQtShareDone={memberQtShareDone}
          setMemberQtShareDone={setMemberQtShareDone}
          memberStreakDone={(streak?.currentStreak ?? 0) >= 3}
        />}

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

        {/* 요약 카드 4개 */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* QT 챌린지 */}
          <motion.div variants={item}>
            <Link to="/qt/complete" className={`stat-card block hover:shadow-lg transition-shadow ${currentStreak >= 3 ? 'border-orange-200 dark:border-orange-800' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <Flame className={`w-4 h-4 ${currentStreak >= 1 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">QT 챌린지</span>
              </div>
              {currentStreak > 0 ? (
                <p className={`text-2xl font-bold ${currentStreak >= 3 ? 'text-orange-500' : ''}`}>
                  {currentStreak}<span className="text-sm font-normal text-muted-foreground ml-1">일 연속</span>
                </p>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">시작해볼까요?</p>
              )}
            </Link>
          </motion.div>

          {/* 성경읽기 챌린지 */}
          <motion.div variants={item}>
            <Link to="/bible-reading" className="stat-card block hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <BookMarked className="w-4 h-4 text-gold" />
                <span className="text-xs text-muted-foreground">성경읽기 챌린지</span>
              </div>
              <p className="text-2xl font-bold">{totalChapters}<span className="text-sm font-normal text-muted-foreground ml-1">장</span></p>
            </Link>
          </motion.div>

          {/* 이번 주 공부 */}
          <motion.div variants={item}>
            <Link to="/bible-study" className="stat-card block hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">이번 주 공부</span>
              </div>
              <div className="flex items-center gap-1.5">
                {studyCompleted ? (
                  <CheckCircle2 className="w-8 h-8 text-success" />
                ) : (
                  <Circle className="w-8 h-8 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold">{studyCompleted ? '완료' : '미완료'}</span>
              </div>
            </Link>
          </motion.div>

          {/* 함께기도 */}
          <motion.div variants={item}>
            <Link to="/prayer-requests?tab=intercession" className="stat-card block hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <HeartHandshake className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">함께기도</span>
              </div>
              {myIntercessions.size > 0 ? (
                <p className="text-2xl font-bold">{myIntercessions.size}<span className="text-sm font-normal text-muted-foreground ml-1">개</span></p>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">시작해볼까요?</p>
              )}
            </Link>
          </motion.div>
        </motion.div>

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

        {/* 성경공부 */}
        {recentStudies.length > 0 && (
          <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.3 }}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> 성경공부
                </h2>
                <Link to="/bible-study" className="text-xs text-primary font-medium hover:underline">전체보기 →</Link>
              </div>
              {recentStudies.map(s => (
                <Link key={s.id} to={`/bible-study/${s.id}`} className="card-elevated p-5 block group">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display font-semibold group-hover:text-primary transition-colors">{s.title}</h3>
                    <span className="text-xs text-muted-foreground">{s.weekNumber}주차</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.scripture}</p>
                  <p className="text-xs text-primary mt-2 font-medium">공부하러 가기 →</p>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* 사용 안내 */}
        <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.35 }}>
          <Link to="/manual" className="card-elevated p-4 flex items-center gap-3 group hover:shadow-lg transition-shadow block">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">사용 안내</h3>
              <p className="text-xs text-muted-foreground">앱 사용법이 궁금하신가요?</p>
            </div>
            <span className="text-xs text-primary font-medium">보기 →</span>
          </Link>
        </motion.div>

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

// ── 이번 주 할 일 가이드 카드 ──────────────────────────────
interface WeeklyGuideCardProps {
  uid: string;
  isLeader: boolean;
  guidePhase: 1 | 2 | 3;
  activeMemberCount: number;
  noticeDone: boolean;
  noticeKey: string;
  setNoticeDone: Dispatch<SetStateAction<boolean>>;
  groupPrayersCount: number;
  schedulesCount: number;
  qtEverDone: boolean;
  totalChapters: number;
  weeklyReportCount: number;
  notifDone: boolean;
  setNotifDone: Dispatch<SetStateAction<boolean>>;
  intercessionDone: boolean;
  bibleStudyExists: boolean;
  qtDashboardDone: boolean;
  setQtDashboardDone: Dispatch<SetStateAction<boolean>>;
  attendanceDone: boolean;
  setAttendanceDone: Dispatch<SetStateAction<boolean>>;
  // 구역원 props
  memberGuidePhase: 1 | 2;
  memberQtDone: boolean;
  memberPrayerDone: boolean;
  memberBibleDone: boolean;
  memberStudyAnswerDone: boolean;
  memberIntercessionDone: boolean;
  memberNotifDone: boolean;
  setMemberNotifDone: Dispatch<SetStateAction<boolean>>;
  memberQtShareDone: boolean;
  setMemberQtShareDone: Dispatch<SetStateAction<boolean>>;
  memberStreakDone: boolean;
}

function WeeklyGuideCard({
  uid,
  isLeader,
  guidePhase,
  activeMemberCount,
  noticeDone,
  noticeKey,
  setNoticeDone,
  groupPrayersCount,
  schedulesCount,
  qtEverDone,
  totalChapters,
  weeklyReportCount,
  notifDone,
  setNotifDone,
  intercessionDone,
  bibleStudyExists,
  qtDashboardDone,
  setQtDashboardDone,
  attendanceDone,
  setAttendanceDone,
  memberGuidePhase,
  memberQtDone,
  memberPrayerDone,
  memberBibleDone,
  memberStudyAnswerDone,
  memberIntercessionDone,
  memberNotifDone,
  setMemberNotifDone,
  memberQtShareDone,
  setMemberQtShareDone,
  memberStreakDone,
}: WeeklyGuideCardProps) {
  const phase1Steps = [
    {
      id: 'invite',
      label: '구역원 초대하기',
      desc: '초대 링크를 복사해서 카카오톡 채팅방에 붙여넣기만 하면 됩니다.',
      link: '/admin?tab=members',
      icon: Megaphone,
      done: activeMemberCount > 1,
    },
    {
      id: 'notice',
      label: '이번 주 모임 공지 보내기',
      desc: '날짜·장소를 입력하면 공지문을 자동으로 만들어 줍니다.',
      link: '/admin?tab=kakao',
      icon: Megaphone,
      done: noticeDone,
      onNav: () => { localStorage.setItem(noticeKey, '1'); setNoticeDone(true); },
    },
    {
      id: 'prayer',
      label: '기도제목 함께 나누기',
      desc: '구역원이 올린 기도제목을 확인하고 함께 기도할 수 있습니다.',
      link: '/prayer-requests',
      icon: MessageSquareHeart,
      done: groupPrayersCount > 0,
    },
    {
      id: 'schedule',
      label: '구역모임 일정 등록하기',
      desc: '모임 날짜와 장소를 등록하면 구역원들이 앱에서 확인합니다.',
      link: '/schedule',
      icon: CalendarDays,
      done: schedulesCount > 0,
    },
  ];

  const phase2Steps = [
    {
      id: 'qt',
      label: 'QT 큐티 참여하기',
      desc: '오늘의 묵상 본문을 읽고 나눔을 올려보세요.',
      link: '/qt',
      icon: BookOpenCheck,
      done: qtEverDone,
    },
    {
      id: 'bible',
      label: '성경읽기 첫 기록',
      desc: '오늘 읽은 성경 장수를 기록하면 진도가 쌓입니다.',
      link: '/bible-reading',
      icon: BookOpen,
      done: totalChapters > 0,
    },
    {
      id: 'report',
      label: '주간 보고서 작성',
      desc: '모임 결과를 요약해 담당자에게 보고할 수 있습니다.',
      link: '/admin?tab=report',
      icon: CheckCircle2,
      done: weeklyReportCount > 0,
    },
    {
      id: 'notif',
      label: '알림 설정하기',
      desc: '기도제목·QT 알림을 켜두면 구역원 활동을 놓치지 않습니다.',
      link: '/profile',
      icon: Bell,
      done: notifDone,
      onNav: () => { localStorage.setItem(`bethel_notifications_setup_done_${uid}`, '1'); setNotifDone(true); },
    },
  ];

  const phase3Steps = [
    {
      id: 'intercession',
      label: '중보기도 요청하기',
      desc: '구역원의 기도제목에 중보기도를 눌러 함께 기도해 주세요.',
      link: '/prayer-requests',
      icon: HeartHandshake,
      done: intercessionDone,
    },
    {
      id: 'bible-study',
      label: '성경공부 과제 만들기',
      desc: '이번 주 공부할 본문과 질문을 올리고 구역원 답변을 확인하세요.',
      link: '/bible-study',
      icon: BookOpen,
      done: bibleStudyExists,
    },
    {
      id: 'qt-dashboard',
      label: '구역원 QT 현황 확인',
      desc: '이번 주 구역원들의 큐티 참여 현황을 한눈에 볼 수 있습니다.',
      link: '/leader/qt-dashboard',
      icon: BookOpenCheck,
      done: qtDashboardDone,
      onNav: () => { localStorage.setItem(`bethel_qt_dashboard_done_${uid}`, '1'); setQtDashboardDone(true); },
    },
    {
      id: 'attendance',
      label: '모임 후 출석 체크',
      desc: '모임이 끝난 후 일정에서 구역원 출석 여부를 표시해 보세요.',
      link: '/schedule',
      icon: CheckCircle2,
      done: attendanceDone,
      onNav: () => { localStorage.setItem(`bethel_attendance_done_${uid}`, '1'); setAttendanceDone(true); },
    },
  ];

  // 구역원 step 세트
  const memberPhase1Steps = [
    {
      id: 'm-qt', label: 'QT 큐티 참여하기',
      desc: '오늘의 묵상 본문을 읽고 나눔을 올려보세요.',
      link: '/qt', icon: BookOpenCheck, done: memberQtDone,
    },
    {
      id: 'm-prayer', label: '기도제목 올리기',
      desc: '내 기도제목을 올리면 구역원들과 함께 기도할 수 있습니다.',
      link: '/prayer-requests', icon: MessageSquareHeart, done: memberPrayerDone,
    },
    {
      id: 'm-bible', label: '성경읽기 기록하기',
      desc: '오늘 읽은 성경 장수를 기록하면 진도가 쌓입니다.',
      link: '/bible-reading', icon: BookOpen, done: memberBibleDone,
    },
    {
      id: 'm-study', label: '성경공부 답변하기',
      desc: '구역장이 올린 이번 주 공부 문제에 답변해 보세요.',
      link: '/bible-study', icon: BookMarked, done: memberStudyAnswerDone,
    },
  ];

  const memberPhase2Steps = [
    {
      id: 'm-intercession', label: '중보기도 참여하기',
      desc: '구역원의 기도제목에 중보기도를 눌러 함께 기도해 주세요.',
      link: '/prayer-requests', icon: HeartHandshake, done: memberIntercessionDone,
    },
    {
      id: 'm-notif', label: '알림 설정하기',
      desc: 'QT·기도제목 알림을 켜두면 구역 소식을 놓치지 않습니다.',
      link: '/profile', icon: Bell, done: memberNotifDone,
      onNav: () => { localStorage.setItem(`bethel_notifications_setup_done_${uid}`, '1'); setMemberNotifDone(true); },
    },
    {
      id: 'm-qt-share', label: 'QT 나눔 읽어보기',
      desc: '다른 구역원들의 큐티 나눔을 읽고 은혜를 나눠보세요.',
      link: '/qt', icon: BookOpenCheck, done: memberQtShareDone,
      onNav: () => { localStorage.setItem(`bethel_qt_share_done_${uid}`, '1'); setMemberQtShareDone(true); },
    },
    {
      id: 'm-streak', label: '성경읽기 3일 연속 기록',
      desc: '3일 연속 성경읽기를 기록하면 스트릭이 시작됩니다.',
      link: '/bible-reading', icon: Flame, done: memberStreakDone,
    },
  ];

  const steps = isLeader
    ? (guidePhase === 1 ? phase1Steps : guidePhase === 2 ? phase2Steps : phase3Steps)
    : (memberGuidePhase === 1 ? memberPhase1Steps : memberPhase2Steps);

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  const phaseSubtitle = !isLeader && memberGuidePhase === 2
    ? '기본 기능 완료 — 더 깊이 참여해보세요'
    : guidePhase === 2 ? '기본 기능 완료 — 새로운 기능을 사용해보세요'
    : guidePhase === 3 ? '앱을 더 깊이 활용해보세요'
    : '';

  // 각 phase 완료 시 다음 접속을 위해 플래그 저장
  useEffect(() => {
    if (!allDone) return;
    if (isLeader) {
      if (guidePhase === 1) localStorage.setItem(`bethel_guide_phase1_done_${uid}`, '1');
      if (guidePhase === 2) localStorage.setItem(`bethel_guide_phase2_done_${uid}`, '1');
    } else {
      if (memberGuidePhase === 1) localStorage.setItem(`bethel_member_guide_phase1_done_${uid}`, '1');
    }
  }, [isLeader, guidePhase, memberGuidePhase, allDone, uid]);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold">이번 주 할 일</p>
          {phaseSubtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{phaseSubtitle}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{doneCount} / {steps.length} 완료</span>
      </div>
      <div className="space-y-1">
        {steps.map(({ label, desc, link, icon: Icon, done, onNav }) => (
          <Link
            key={link}
            to={link}
            onClick={onNav}
            className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
              done ? 'opacity-50' : 'hover:bg-muted/60'
            }`}
          >
            {done
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              : <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${done ? 'line-through' : ''}`}>{label}</p>
              {!done && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
            </div>
            {!done && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
          </Link>
        ))}
      </div>
      {allDone && (
        <p className="text-xs text-center text-green-600 font-medium mt-3">
          {(!isLeader && memberGuidePhase === 2) || guidePhase === 3
            ? '앱의 모든 기능을 체험하셨습니다!'
            : '완료! 다음 접속 시 새로운 기능을 소개해 드릴게요.'}
        </p>
      )}
    </div>
  );
}
