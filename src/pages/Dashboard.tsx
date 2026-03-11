import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, BookMarked, MessageSquareHeart, Sparkles, CheckCircle2, Circle, CalendarDays, MapPin, Clock, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { getBibleStudies, getStudyAnswer, getPrayerRequests, getTotalChapters, getSchedules, getTodayDevotional } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const { user } = useAuth();

  const { data: studies = [] } = useQuery({
    queryKey: ['bible_studies'],
    queryFn: getBibleStudies,
  });

  const latestStudy = studies[0];

  const { data: latestAnswer } = useQuery({
    queryKey: ['study_answer', latestStudy?.id, user?.id],
    queryFn: () => getStudyAnswer(latestStudy!.id, user!.id),
    enabled: !!latestStudy && !!user,
  });

  const { data: prayers = [] } = useQuery({
    queryKey: ['prayer_requests'],
    queryFn: getPrayerRequests,
  });

  const { data: totalChapters = 0 } = useQuery({
    queryKey: ['total_chapters', user?.id],
    queryFn: () => getTotalChapters(user!.id),
    enabled: !!user,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules'],
    queryFn: getSchedules,
  });

  const { data: devotional, isLoading: devotionalLoading } = useQuery({
    queryKey: ['today_devotional'],
    queryFn: getTodayDevotional,
    staleTime: 1000 * 60 * 30, // 30분 캐시
  });

  const studyCompleted = latestAnswer?.completed ?? false;
  const unansweredPrayers = prayers.filter(p => !p.answered);

  const now = new Date();
  const twoMonthsLater = new Date(now);
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);
  const upcomingSchedules = useMemo(() =>
    schedules
      .filter(s => { const d = new Date(s.date); return d >= new Date(now.toISOString().split('T')[0]) && d <= twoMonthsLater; })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3),
    [schedules]
  );

  const [showPopup, setShowPopup] = useState(false);
  useEffect(() => {
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
    if (devotional) {
      return {
        verse: devotional.verse,
        summary: `${devotional.content}${devotional.applicationQuestion ? `\n\n✦ ${devotional.applicationQuestion}` : ''}`,
        link: devotional.sourceUrl ?? 'https://sum.su.or.kr:8888/bible/today',
        isLoaded: true,
      };
    }
    return {
      verse: '매일 06:00 업데이트',
      summary: devotionalLoading
        ? '오늘의 묵상을 불러오는 중...'
        : '오늘의 묵상이 아직 준비되지 않았습니다.',
      link: 'https://sum.su.or.kr:8888/bible/today',
      isLoaded: false,
    };
  }, [devotional, devotionalLoading]);

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
              <p className="text-2xl font-bold">{unansweredPrayers.length}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
            </Link>
          </motion.div>

          {/* Week number */}
          <motion.div variants={item}>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-gold" />
                <span className="text-xs text-muted-foreground">현재 주차</span>
              </div>
              <p className="text-2xl font-bold">{latestStudy?.weekNumber ?? '-'}<span className="text-sm font-normal text-muted-foreground ml-1">주</span></p>
            </div>
          </motion.div>
        </motion.div>

        {/* Today's QT */}
        <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.3 }}>
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-gold" />
              <h2 className="font-display font-semibold">{todayQT.title}</h2>
              <span className="gold-badge ml-auto">{todayQT.verse.slice(0, 20)}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{todayQT.summary}</p>
            {todayQT.isLoaded && (
              <a
                href={todayQT.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-xs text-primary font-medium hover:underline"
              >
                오늘의 묵상 원문 보기 →
              </a>
            )}
          </div>
        </motion.div>

        {/* Latest study preview */}
        {latestStudy && (
          <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.35 }}>
            <Link to={`/bible-study/${latestStudy.id}`} className="card-elevated p-5 block group">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display font-semibold group-hover:text-primary transition-colors">
                  {latestStudy.title}
                </h2>
                <span className="text-xs text-muted-foreground">{latestStudy.weekNumber}주차</span>
              </div>
              <p className="text-sm text-muted-foreground">{latestStudy.scripture}</p>
              <p className="text-xs text-primary mt-2 font-medium">공부하러 가기 →</p>
            </Link>
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
