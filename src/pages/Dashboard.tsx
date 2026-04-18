import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, BookMarked, MessageSquareHeart, Sparkles, CheckCircle2, Circle, CalendarDays, MapPin, Clock, X, HeartHandshake, HelpCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import { getBibleStudies, getStudyAnswer, getUnansweredPrayerCount, getTotalChapters, getUpcomingSchedules, getTodayQT, getMyStreak, getKSTDateString, getGroupPrayerRequests, getMyIntercessions, getIntercessionCounts, toggleIntercession } from '@/lib/api';
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
  });

  const { data: streak } = useQuery({
    queryKey: ['streak', user?.id],
    queryFn: () => getMyStreak(user!.id),
    enabled: !!user?.id,
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
        summary: todayQt.summary ?? '',
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
        <div>
          <h1 className="font-display text-2xl font-bold">
            안녕하세요, {user?.name}님
          </h1>
          <p className="text-muted-foreground text-sm mt-1">이번 주도 은혜로운 한 주 보내세요!</p>
        </div>

        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Study status */}
          <motion.div variants={item}>
            <Link to="/bible-study" className="stat-card block hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">이번 주 공부</span>
              </div>
              <div className="flex items-center gap-1.5">
                {studyCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold">{studyCompleted ? '완료' : '미완료'}</span>
              </div>
            </Link>
          </motion.div>

          {/* Bible reading */}
          <motion.div variants={item}>
            <Link to="/bible-reading" className="stat-card block hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <BookMarked className="w-4 h-4 text-gold" />
                <span className="text-xs text-muted-foreground">2026 성경읽기</span>
              </div>
              <p className="text-2xl font-bold">{totalChapters}<span className="text-sm font-normal text-muted-foreground ml-1">장</span></p>
            </Link>
          </motion.div>

          {/* Prayer requests */}
          <motion.div variants={item}>
            <Link to="/prayer-requests" className="stat-card block hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquareHeart className="w-4 h-4 text-destructive" />
                <span className="text-xs text-muted-foreground">기도제목</span>
              </div>
              <p className="text-2xl font-bold">{unansweredPrayerCount}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
            </Link>
          </motion.div>

          {/* 함께 기도 (중보기도 참여 수) */}
          <motion.div variants={item}>
            <Link to="/prayer-requests" className="stat-card block hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <HeartHandshake className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">함께 기도</span>
              </div>
              <p className="text-2xl font-bold">{myIntercessions.size}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
            </Link>
          </motion.div>
        </motion.div>

        {/* 중보기도 섹션 */}
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

        {/* Today's QT */}
        <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.3 }}>
          <Link to="/qt" className="block card-elevated p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-gold" />
              <h2 className="font-display font-semibold">오늘의 묵상</h2>
              {(streak?.currentStreak ?? 0) > 0 && (
                <span className="ml-auto text-xs text-orange-500 font-semibold">🔥 {streak!.currentStreak}일</span>
              )}
            </div>
            {todayQT.verse && todayQT.isLoaded && (
              <p className="text-xs text-primary font-medium mb-1">{todayQT.verse}</p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{todayQT.summary}</p>
            {todayQT.isLoaded && (
              <span className="inline-block mt-3 text-xs text-primary font-medium">
                묵상하러 가기 →
              </span>
            )}
          </Link>
        </motion.div>

        {/* Latest study preview */}
        {recentStudies.length > 0 && (
          <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.35 }}>
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
                    <h3 className="font-display font-semibold group-hover:text-primary transition-colors">
                      {s.title}
                    </h3>
                    <span className="text-xs text-muted-foreground">{s.weekNumber}주차</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.scripture}</p>
                  <p className="text-xs text-primary mt-2 font-medium">공부하러 가기 →</p>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Upcoming schedules */}
        {upcomingSchedules.length > 0 && (
          <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.4 }}>
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

        {/* Manual link */}
        <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.45 }}>
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
