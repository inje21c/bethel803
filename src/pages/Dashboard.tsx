import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, BookMarked, MessageSquareHeart, Sparkles, CheckCircle2, Circle, CalendarDays, MapPin, Clock, X } from 'lucide-react';
import { store, mockStudies } from '@/lib/store';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const user = store.getUser();
  const answers = store.getAnswers();
  const prayers = store.getPrayers();
  const totalChapters = store.getTotalChapters(user?.id || '');
  const latestStudy = mockStudies[0];
  const studyCompleted = answers.some(a => a.studyId === latestStudy.id && a.completed);
  const unansweredPrayers = prayers.filter(p => !p.answered);

  // Upcoming schedules (next 2 months)
  const schedules = store.getSchedules();
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

  // Schedule popup on login
  const [showPopup, setShowPopup] = useState(false);
  useEffect(() => {
    const popupKey = `bethel-popup-${now.toISOString().split('T')[0]}`;
    if (upcomingSchedules.length > 0 && !sessionStorage.getItem(popupKey)) {
      setShowPopup(true);
      sessionStorage.setItem(popupKey, '1');
    }
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  };

  const todayQT = useMemo(() => ({
    title: '오늘의 묵상',
    verse: '빌립보서 4:6-7',
    summary: '아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라. 그리하면 모든 지각에 뛰어난 하나님의 평강이 그리스도 예수 안에서 너희 마음과 생각을 지키시리라.',
    link: 'https://www.duranno.com/qt/',
  }), []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">
            안녕하세요, {user?.name}님 👋
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
              <p className="text-2xl font-bold">{latestStudy.weekNumber}<span className="text-sm font-normal text-muted-foreground ml-1">주</span></p>
            </div>
          </motion.div>
        </motion.div>

        {/* Today's QT */}
        <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.3 }}>
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-gold" />
              <h2 className="font-display font-semibold">{todayQT.title}</h2>
              <span className="gold-badge ml-auto">{todayQT.verse}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{todayQT.summary}</p>
            <a
              href={todayQT.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs text-primary font-medium hover:underline"
            >
              매일성경 QT 바로가기 →
            </a>
          </div>
        </motion.div>

        {/* Latest study preview */}
        <motion.div variants={item} initial="hidden" animate="show" transition={{ delay: 0.4 }}>
          <Link to={`/bible-study/${latestStudy.id}`} className="card-elevated p-5 block group">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-semibold group-hover:text-primary transition-colors">
                📖 {latestStudy.title}
              </h2>
              <span className="text-xs text-muted-foreground">{latestStudy.weekNumber}주차</span>
            </div>
            <p className="text-sm text-muted-foreground">{latestStudy.scripture}</p>
            <p className="text-xs text-primary mt-2 font-medium">공부하러 가기 →</p>
          </Link>
        </motion.div>
      </div>
    </AppLayout>
  );
}
